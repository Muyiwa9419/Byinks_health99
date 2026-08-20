import {
  User,
  Appointment,
  AppNotification,
  Transaction,
  UserRole,
  SyncRequest,
  MedicalReport,
  Prescription,
  DeliveryOrder,
  ChatThread,
  ChatMessage,
} from '../types.ts';

import { io, Socket } from 'socket.io-client';

const API_URL =
  import.meta.env.VITE_API_URL || 'https://byinks-health99.onrender.com';

let socket: Socket | null = null;

/**
 * ---------------------------------------------------------
 * SOCKET.IO
 * ---------------------------------------------------------
 */

const getSocket = (): Socket => {
  if (!socket) {
    const token = localStorage.getItem('medi_auth_token');

    socket = io(API_URL, {
      auth: {
        token,
      },
      transports: ['websocket'],
      autoConnect: true,
    });

    socket.on('connect_error', (error) => {
      console.error(
        'Socket connection error:',
        error.message
      );
    });
  }

  return socket;
};

/**
 * Supabase is no longer used for the backend relay.
 * Kept as null so older parts of the application that
 * check ClinicalAPI.isConfigured() do not crash.
 */
export const supabase = null as any;

/**
 * Local browser bridge.
 * Useful for communication between browser tabs.
 */
const clinicalBridge = new BroadcastChannel(
  'medi_clinical_bridge'
);

/**
 * ---------------------------------------------------------
 * LOCAL STORAGE HELPERS
 * ---------------------------------------------------------
 */

const getLocalCollection = <T>(key: string): T[] => {
  try {
    return JSON.parse(
      localStorage.getItem(`medi_${key}`) || '[]'
    );
  } catch {
    return [];
  }
};

const saveLocalCollection = (
  key: string,
  data: any
) => {
  const fullKey =
    key.startsWith('medi_') ||
    key.startsWith('chat_')
      ? key
      : `medi_${key}`;

  localStorage.setItem(
    fullKey,
    JSON.stringify(data)
  );

  clinicalBridge.postMessage({
    type: 'COLLECTION_UPDATE',
    key: fullKey,
    data,
  });

  window.dispatchEvent(
    new Event('storage')
  );
};

/**
 * ---------------------------------------------------------
 * CLINICAL API
 * ---------------------------------------------------------
 */

export const ClinicalAPI = {

  /**
   * -------------------------------------------------------
   * AUTHENTICATED FETCH
   * -------------------------------------------------------
   */

  async authFetch(
    endpoint: string,
    options: RequestInit = {}
  ) {
    const token =
      localStorage.getItem(
        'medi_auth_token'
      );

    if (!token) {
      throw new Error(
        'Authentication token not found. Please log in again.'
      );
    }

    const response = await fetch(
      `${API_URL}${endpoint}`,
      {
        ...options,

        headers: {
          'Content-Type':
            'application/json',

          ...(options.headers || {}),

          Authorization:
            `Bearer ${token}`,
        },
      }
    );

    const data =
      await response
        .json()
        .catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        data.error ||
        data.message ||
        `Request failed: ${response.status}`
      );
    }

    return data;
  },

  /**
   * -------------------------------------------------------
   * SOCKET METHODS
   * -------------------------------------------------------
   */

  getSocket() {
    return getSocket();
  },

  connectSocket() {
    const socketInstance =
      getSocket();

    if (!socketInstance.connected) {
      socketInstance.connect();
    }

    return socketInstance;
  },

  disconnectSocket() {
    if (socket) {
      socket.disconnect();
      socket = null;
    }
  },

  /**
   * -------------------------------------------------------
   * GENERAL / BRIDGE
   * -------------------------------------------------------
   */

  isConfigured(): boolean {
    return true;
  },

  getBridge() {
    return clinicalBridge;
  },

  subscribeToGlobalSystem(
    onEvent: (payload: any) => void
  ) {
    const socketInstance =
      getSocket();

    const handler = (payload: any) => {
      onEvent(payload);
    };

    socketInstance.on(
      'system:update',
      handler
    );

    return {
      unsubscribe() {
        socketInstance.off(
          'system:update',
          handler
        );
      },
    };
  },

  /**
   * -------------------------------------------------------
   * CHAT SOCKET SUBSCRIPTION
   * -------------------------------------------------------
   */

  subscribeToClinicalCloud(
    chatId: string,
    onMessage: (msg: any) => void,
    onStatusChange?: (
      status: string
    ) => void
  ) {
    const socketInstance =
      getSocket();

    const handleConnect = () => {
      socketInstance.emit(
        'chat:join',
        chatId
      );

      if (onStatusChange) {
        onStatusChange('SUBSCRIBED');
      }
    };

    const handleMessage = (
      message: ChatMessage
    ) => {
      onMessage(message);
    };

    const handleEnded = (
      payload: any
    ) => {
      onMessage({
        type: 'SESSION_ENDED',
        ...payload,
      });
    };

    if (
      socketInstance.connected
    ) {
      handleConnect();
    } else {
      if (onStatusChange) {
        onStatusChange(
          'CONNECTING'
        );
      }

      socketInstance.once(
        'connect',
        handleConnect
      );
    }

    socketInstance.on(
      'chat:message',
      handleMessage
    );

    socketInstance.on(
      'chat:ended',
      handleEnded
    );

    return {
      unsubscribe() {
        socketInstance.emit(
          'chat:leave',
          chatId
        );

        socketInstance.off(
          'chat:message',
          handleMessage
        );

        socketInstance.off(
          'chat:ended',
          handleEnded
        );

        socketInstance.off(
          'connect',
          handleConnect
        );
      },
    };
  },

  /**
   * -------------------------------------------------------
   * CHAT
   * -------------------------------------------------------
   */

  async getActiveThreads(
    userId: string
  ): Promise<ChatThread[]> {
    return await this.authFetch(
      `/api/chat/threads/${userId}`
    );
  },

  async getChatMessages(
    chatId: string
  ): Promise<ChatMessage[]> {
    return await this.authFetch(
      `/api/chat/${chatId}/messages`
    );
  },

  async sendChatMessage(
    chatId: string,
    message: {
      text: string;
      isSystem?: boolean;
    }
  ): Promise<ChatMessage> {
    return await this.authFetch(
      `/api/chat/${chatId}/messages`,
      {
        method: 'POST',
        body: JSON.stringify(
          message
        ),
      }
    );
  },

  async endChatSession(
    chatId: string
  ): Promise<void> {
    await this.authFetch(
      `/api/chat/${chatId}/end`,
      {
        method: 'POST',
      }
    );
  },

  /**
   * Send a chat message to the backend.
   *
   * The backend will:
   * 1. Save the message in PostgreSQL
   * 2. Update/create the chat thread
   * 3. Broadcast the message through Socket.IO
   */

  async broadcastMessage(
    chatId: string,
    message: ChatMessage
  ) {
    try {
      const savedMessage =
        await this.authFetch(
          `/api/chat/${chatId}/messages`,
          {
            method: 'POST',

            body: JSON.stringify({
              senderId:
                message.senderId,

              senderName:
                message.senderName,

              text:
                message.text,

              isSystem:
                !!message.isSystem,
            }),
          }
        );

      /**
       * Keep local browser storage synchronized.
       */

      const threads =
        getLocalCollection<ChatThread>(
          'chat_threads'
        );

      const participants =
        chatId.split('--');

      const existingIndex =
        threads.findIndex(
          (thread) =>
            thread.chatId === chatId
        );

      const threadData: ChatThread = {
        chatId,
        participants,
        lastMessage:
          savedMessage ||
          message,
        updatedAt:
          Date.now(),
      };

      if (
        existingIndex >= 0
      ) {
        threads[
          existingIndex
        ] = threadData;
      } else {
        threads.push(
          threadData
        );
      }

      saveLocalCollection(
        'chat_threads',
        threads
      );

      clinicalBridge.postMessage({
        type: 'CHAT_MESSAGE',
        chatId,
        message:
          savedMessage ||
          message,
      });

      return (
        savedMessage ||
        message
      );
    } catch (error) {
      console.error(
        'Failed to broadcast chat message:',
        error
      );

      throw error;
    }
  },

  async broadcastEndSession(
    chatId: string
  ) {
    try {
      await this.endChatSession(
        chatId
      );
    } catch (error) {
      console.error(
        'Failed to end chat session on server:',
        error
      );
    }

    clinicalBridge.postMessage({
      type: 'CHAT_CLOSED',
      chatId,
    });

    const threads =
      getLocalCollection<ChatThread>(
        'chat_threads'
      );

    const filtered =
      threads.filter(
        (thread) =>
          thread.chatId !== chatId
      );

    saveLocalCollection(
      'chat_threads',
      filtered
    );
  },

  /**
   * -------------------------------------------------------
   * APPOINTMENTS
   * -------------------------------------------------------
   */

  async saveAppointments(
    apps: Appointment[]
  ) {
    for (
      const appointment of apps
    ) {
      await this.authFetch(
        `/api/appointments/${appointment.id}`,
        {
          method: 'PATCH',

          body: JSON.stringify(
            appointment
          ),
        }
      );
    }
  },

  async getAppointments(
    filters?: {
      patientId?: string;
      consultantId?: string;
    }
  ): Promise<Appointment[]> {
    const params =
      new URLSearchParams();

    if (
      filters?.patientId
    ) {
      params.set(
        'patientId',
        filters.patientId
      );
    }

    if (
      filters?.consultantId
    ) {
      params.set(
        'consultantId',
        filters.consultantId
      );
    }

    const query =
      params.toString();

    return await this.authFetch(
      `/api/appointments${
        query
          ? `?${query}`
          : ''
      }`
    );
  },

  async createAppointment(
    appointment: Omit<
      Appointment,
      'id'
    >
  ): Promise<Appointment> {
    return await this.authFetch(
      '/api/appointments',
      {
        method: 'POST',

        body: JSON.stringify(
          appointment
        ),
      }
    );
  },

  async updateAppointment(
    appointmentId: string,
    updates: Partial<Appointment>
  ): Promise<Appointment> {
    return await this.authFetch(
      `/api/appointments/${appointmentId}`,
      {
        method: 'PATCH',

        body: JSON.stringify(
          updates
        ),
      }
    );
  },

  async cancelAppointment(
    appointmentId: string
  ): Promise<Appointment> {
    return await this.authFetch(
      `/api/appointments/${appointmentId}/cancel`,
      {
        method: 'POST',
      }
    );
  },

  async rescheduleAppointment(
    appointmentId: string,
    date: string,
    time: string
  ): Promise<Appointment> {
    return await this.authFetch(
      `/api/appointments/${appointmentId}/reschedule`,
      {
        method: 'POST',

        body: JSON.stringify({
          date,
          time,
        }),
      }
    );
  },

  async getAvailability(
    consultantId: string
  ): Promise<any> {
    return await this.authFetch(
      `/api/appointments/availability/${consultantId}`
    );
  },

  async setAvailability(
    consultantId: string,
    blockedSlots: Record<
      string,
      any
    >
  ): Promise<any> {
    return await this.authFetch(
      `/api/appointments/availability/${consultantId}`,
      {
        method: 'PUT',

        body: JSON.stringify({
          blockedSlots,
        }),
      }
    );
  },

  /**
   * -------------------------------------------------------
   * MEDICAL REPORTS
   * -------------------------------------------------------
   */

  async getReports(
    filters?: {
      patientId?: string;
      status?: string;
    }
  ): Promise<MedicalReport[]> {
    const params =
      new URLSearchParams();

    if (
      filters?.patientId
    ) {
      params.set(
        'patientId',
        filters.patientId
      );
    }

    if (
      filters?.status
    ) {
      params.set(
        'status',
        filters.status
      );
    }

    const query =
      params.toString();

    return await this.authFetch(
      `/api/reports${
        query
          ? `?${query}`
          : ''
      }`
    );
  },

  async reviewReport(
    reportId: string,
    updates: {
      status: string;
      consultantNote?: string;
      vettedBy?: string;
    }
  ): Promise<MedicalReport> {
    return await this.authFetch(
      `/api/reports/${reportId}/review`,
      {
        method: 'PATCH',

        body: JSON.stringify(
          updates
        ),
      }
    );
  },

  /**
   * -------------------------------------------------------
   * LOCAL COLLECTIONS
   * -------------------------------------------------------
   */

  async saveNotifications(
    notifs: AppNotification[]
  ) {
    saveLocalCollection(
      'notifications',
      notifs
    );
  },

  async saveUsers(
    users: User[]
  ) {
    saveLocalCollection(
      'registered_users',
      users
    );
  },

  async saveReports(
    reports: MedicalReport[]
  ) {
    saveLocalCollection(
      'reports',
      reports
    );
  },

  async savePrescriptions(
    prescriptions: Prescription[]
  ) {
    saveLocalCollection(
      'prescriptions',
      prescriptions
    );
  },

  async saveDeliveries(
    deliveries: DeliveryOrder[]
  ) {
    saveLocalCollection(
      'deliveries',
      deliveries
    );
  },

  /**
   * -------------------------------------------------------
   * NOTIFICATIONS
   * -------------------------------------------------------
   */

  async addNotification(
    userId: string,
    title: string,
    message: string,
    type: AppNotification['type'] =
      'system'
  ) {
    const notifications =
      getLocalCollection<AppNotification>(
        'notifications'
      );

    notifications.push({
      id:
        Math.random()
          .toString(36)
          .substr(2, 9),

      userId,

      title,

      message,

      timestamp:
        new Date().toISOString(),

      isRead: false,

      type,
    });

    await this.saveNotifications(
      notifications
    );
  },

  /**
   * -------------------------------------------------------
   * USER PROFILE
   * -------------------------------------------------------
   */

  async getProfile(
    userId: string
  ): Promise<User | null> {
    try {
      const data =
        await this.authFetch(
          `/api/users/${userId}`
        );

      return data;
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes('404')
      ) {
        return null;
      }

      throw error;
    }
  },

  async saveProfile(
    user: User
  ): Promise<void> {
    await this.authFetch(
      `/api/users/${user.id}`,
      {
        method: 'PATCH',

        body: JSON.stringify({
          name: user.name,
          specialty:
            user.specialty,
          avatar: user.avatar,
          age: user.age,
          bloodType:
            user.bloodType,
          genotype:
            user.genotype,
          height: user.height,
          weight: user.weight,
          phone: user.phone,
          address: user.address,
          emergencyContactName:
            user.emergencyContactName,
          emergencyContactPhone:
            user.emergencyContactPhone,
          location:
            user.location,
        }),
      }
    );

    localStorage.setItem(
      'medi_local_session',
      JSON.stringify(user)
    );
  },

  /**
   * -------------------------------------------------------
   * CLINICAL SNAPSHOT
   * -------------------------------------------------------
   */

  getClinicalSnapshot() {
    const snapshot:
      Record<string, string> = {};

    for (
      let i = 0;
      i < localStorage.length;
      i++
    ) {
      const key =
        localStorage.key(i);

      if (
        key &&
        (
          key.startsWith(
            'medi_'
          ) ||
          key.startsWith(
            'chat_'
          )
        )
      ) {
        snapshot[key] =
          localStorage.getItem(
            key
          ) || '';
      }
    }

    return snapshot;
  },

  restoreClinicalSnapshot(
    snapshot: Record<
      string,
      string
    >
  ) {
    Object.entries(
      snapshot
    ).forEach(
      ([key, value]) => {
        localStorage.setItem(
          key,
          value
        );
      }
    );

    clinicalBridge.postMessage({
      type: 'FULL_RESTORE',
    });

    window.dispatchEvent(
      new Event('storage')
    );
  },

  /**
   * -------------------------------------------------------
   * CLOUD VAULT
   * -------------------------------------------------------
   */

  pushToCloud(
    email: string,
    data: Record<
      string,
      string
    >
  ) {
    localStorage.setItem(
      `cloud_vault_${email.toLowerCase()}`,
      JSON.stringify(data)
    );
  },

  pullFromCloud(
    email: string
  ): Record<
    string,
    string
  > | null {
    const data =
      localStorage.getItem(
        `cloud_vault_${email.toLowerCase()}`
      );

    return data
      ? JSON.parse(data)
      : null;
  },

  /**
   * -------------------------------------------------------
   * DEFAULT LOCAL DATA
   * -------------------------------------------------------
   */

  seedDefaultData() {
    const users =
      getLocalCollection<User>(
        'registered_users'
      );

    if (
      users.length === 0
    ) {
      const defaults: User[] =
        [
          {
            id: 'admin-1',
            name: 'Byinks Admin',
            email:
              'admin@byinkshealth.com',
            role:
              UserRole.ADMIN,
            isApproved: true,
          },

          {
            id: 'pharm-1',
            name:
              'Global Pharma Hub',
            email:
              'pharmacy@byinkshealth.com',
            role:
              UserRole.PHARMACY,
            isApproved: true,
          },

          {
            id: 'dispatch-1',
            name:
              'Swift Delivery Pro',
            email:
              'dispatch@byinkshealth.com',
            role:
              UserRole.DISPATCH,
            isApproved: true,
            isOnline: true,
          },
        ];

      this.saveUsers(
        defaults
      );
    }
  },

  /**
   * -------------------------------------------------------
   * CHANGE PASSWORD
   * -------------------------------------------------------
   */

  async changePassword(
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    await this.authFetch(
      '/api/users/change-password',
      {
        method: 'PATCH',

        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      }
    );
  },

  /**
   * -------------------------------------------------------
   * SIGN UP
   * -------------------------------------------------------
   */

  async signUp(
    email: string,
    pass: string,
    profile: User
  ): Promise<User> {
    const response =
      await fetch(
        `${API_URL}/api/auth/signup`,
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json',
          },

          body: JSON.stringify({
            name:
              profile.name,

            email,

            password:
              pass,

            role:
              profile.role,

            specialty:
              profile.specialty,

            avatar:
              profile.avatar,

            age:
              profile.age,

            bloodType:
              profile.bloodType,

            genotype:
              profile.genotype,

            height:
              profile.height,

            weight:
              profile.weight,

            phone:
              profile.phone,

            address:
              profile.address,

            emergencyContactName:
              profile.emergencyContactName,

            emergencyContactPhone:
              profile.emergencyContactPhone,

            locationLat:
              profile.location
                ?.lat,

            locationLng:
              profile.location
                ?.lng,
          }),
        }
      );

    const data =
      await response.json();

    if (
      !response.ok
    ) {
      throw new Error(
        data.error ||
        'Registration failed'
      );
    }

    /**
     * Approved users can immediately
     * receive a session.
     */

    if (
      data.approved === true &&
      data.token
    ) {
      localStorage.setItem(
        'medi_local_session',
        JSON.stringify(
          data.user
        )
      );

      localStorage.setItem(
        'medi_auth_token',
        data.token
      );
    } else {
      /**
       * Consultants and other users
       * awaiting approval should NOT
       * receive a login session.
       */

      localStorage.removeItem(
        'medi_local_session'
      );

      localStorage.removeItem(
        'medi_auth_token'
      );
    }

    return data.user;
  },

  /**
   * -------------------------------------------------------
   * SIGN IN
   * -------------------------------------------------------
   */

  async signIn(
    email: string,
    pass: string
  ): Promise<User> {
    const response =
      await fetch(
        `${API_URL}/api/auth/signin`,
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json',
          },

          body: JSON.stringify({
            email,
            password:
              pass,
          }),
        }
      );

    const data =
      await response.json();

    if (
      !response.ok
    ) {
      throw new Error(
        data.error ||
        'Login failed'
      );
    }

    localStorage.setItem(
      'medi_local_session',
      JSON.stringify(
        data.user
      )
    );

    localStorage.setItem(
      'medi_auth_token',
      data.token
    );

    /**
     * Recreate the socket with
     * the newly received token.
     */

    if (socket) {
      socket.disconnect();
      socket = null;
    }

    return data.user;
  },

  /**
   * -------------------------------------------------------
   * SIGN OUT
   * -------------------------------------------------------
   */

  async signOut() {
    const token =
      localStorage.getItem(
        'medi_auth_token'
      );

    try {
      if (token) {
        await fetch(
          `${API_URL}/api/auth/signout`,
          {
            method: 'POST',

            headers: {
              Authorization:
                `Bearer ${token}`,
            },
          }
        );
      }
    } finally {
      if (socket) {
        socket.disconnect();
        socket = null;
      }

      localStorage.removeItem(
        'medi_local_session'
      );

      localStorage.removeItem(
        'medi_auth_token'
      );

      clinicalBridge.postMessage({
        type: 'SIGN_OUT',
      });
    }
  },

  /**
   * -------------------------------------------------------
   * USERS
   * -------------------------------------------------------
   */

  async getAllUsers(): Promise<User[]> {
    return await this.authFetch(
      '/api/users'
    );
  },

  async getConsultants(): Promise<User[]> {
    const consultants =
      await this.authFetch(
        '/api/users/consultants'
      );

    console.log(
      'DATABASE CONSULTANTS:',
      consultants
    );

    return consultants;
  },

  /**
   * -------------------------------------------------------
   * SYNC REQUESTS
   * -------------------------------------------------------
   */

  async getSyncRequests(): Promise<SyncRequest[]> {
    return getLocalCollection<SyncRequest>(
      'sync_requests'
    );
  },

  async updateSyncRequestStatus(
    requestId: string,
    status:
      | 'approved'
      | 'rejected'
  ): Promise<void> {
    const requests =
      getLocalCollection<SyncRequest>(
        'sync_requests'
      );

    const index =
      requests.findIndex(
        (request) =>
          request.id ===
          requestId
      );

    if (
      index > -1
    ) {
      requests[index] = {
        ...requests[index],
        status,
      };

      saveLocalCollection(
        'sync_requests',
        requests
      );
    }
  },

  /**
   * -------------------------------------------------------
   * ADMIN USER MANAGEMENT
   * -------------------------------------------------------
   */

  async adminCreateUser(
    user: User
  ): Promise<User> {
    const data =
      await this.authFetch(
        '/api/users',
        {
          method: 'POST',

          body: JSON.stringify({
            name:
              user.name,

            email:
              user.email,

            password:
              user.password,

            role:
              user.role,

            specialty:
              user.specialty,

            avatar:
              user.avatar,

            age:
              user.age,

            bloodType:
              user.bloodType,

            genotype:
              user.genotype,

            height:
              user.height,

            weight:
              user.weight,

            phone:
              user.phone,

            address:
              user.address,

            emergencyContactName:
              user.emergencyContactName,

            emergencyContactPhone:
              user.emergencyContactPhone,

            locationLat:
              user.location
                ?.lat,

            locationLng:
              user.location
                ?.lng,
          }),
        }
      );

    return data;
  },

  async removeUser(
    userId: string
  ): Promise<void> {
    await this.authFetch(
      `/api/users/${userId}`,
      {
        method: 'DELETE',
      }
    );
  },

  async updateUserStatus(
    userId: string,
    updates: Partial<User>
  ): Promise<void> {
    await this.authFetch(
      `/api/users/${userId}/status`,
      {
        method: 'PATCH',

        body: JSON.stringify(
          updates
        ),
      }
    );
  },

};