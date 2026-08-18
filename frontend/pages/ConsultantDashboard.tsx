import React, { useState, useEffect } from 'react';
import {
  User,
  UserRole,
  Appointment,
  MedicalReport,
  Prescription,
  ChatThread,
} from '../types.ts';
import { analyzeMedicalReport } from '../services/geminiService.ts';
import CommunicationOverlay from '../components/CommunicationOverlay.tsx';
import { ClinicalAPI } from '../services/apiService.ts';
import { Link } from 'react-router-dom';

interface ConsultantDashboardProps {
  user: User;
}

const ConsultantDashboard: React.FC<ConsultantDashboardProps> = ({ user }) => {
  const [reports, setReports] = useState<MedicalReport[]>([]);
  const [selectedReport, setSelectedReport] =
    useState<MedicalReport | null>(null);

  const [patientData, setPatientData] = useState<User | null>(null);
  const [aiReportInsight, setAiReportInsight] = useState('');
  const [prescribingFor, setPrescribingFor] =
    useState<MedicalReport | null>(null);

  const [prescriptionData, setPrescriptionData] = useState({
    medications: '',
    dosage: '',
  });

  const [loadingAI, setLoadingAI] = useState(false);
  const [activeThreads, setActiveThreads] = useState<ChatThread[]>([]);

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isCommOpen, setIsCommOpen] = useState(false);

  const [selectedPatient, setSelectedPatient] = useState<{
    id: string;
    name: string;
  } | null>(null);

  /*
   * ============================================================
   * LOAD CONSULTANT DASHBOARD DATA
   * ============================================================
   */

  useEffect(() => {
    const fetchData = async () => {
      try {
        console.log('Loading consultant dashboard for:', user.id);

        // Load consultant appointments
        const apps = await ClinicalAPI.getAppointments({
          consultantId: user.id,
        });

        console.log('CONSULTANT APPOINTMENTS:', apps);
        setAppointments(apps);

        // Load reports waiting for review
        const pendingReports = await ClinicalAPI.getReports({
          status: 'pending_review',
        });

        console.log(
          'CONSULTANT REPORTS FROM DATABASE:',
          pendingReports
        );

        setReports(pendingReports);

        // Load active chat sessions
        const threads = await ClinicalAPI.getActiveThreads(user.id);

        console.log('ACTIVE CHAT THREADS:', threads);

        setActiveThreads(threads);
      } catch (error) {
        console.error(
          'Failed to load consultant dashboard:',
          error
        );
      }
    };

    fetchData();

    const handleStorage = () => {
      fetchData();
    };

    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener('storage', handleStorage);
    };
  }, [user.id]);

  /*
   * ============================================================
   * OPEN / REVIEW MEDICAL REPORT
   * ============================================================
   */

  const handleVetReport = async (report: MedicalReport) => {
    try {
      setSelectedReport(report);
      setLoadingAI(true);
      setAiReportInsight('');

      const profile = await ClinicalAPI.getProfile(report.patientId);

      setPatientData(profile);

      const insight = await analyzeMedicalReport(
        `Patient: ${report.patientName}, File: ${
          report.fileName
        }, Emergency Contact: ${
          profile?.emergencyContactName || 'None'
        }`
      );

      setAiReportInsight(insight);
    } catch (error) {
      console.error('Failed to load report:', error);

      setAiReportInsight(
        'Unable to generate clinical insight.'
      );
    } finally {
      setLoadingAI(false);
    }
  };

  /*
   * ============================================================
   * ISSUE PRESCRIPTION
   * ============================================================
   */

  const handleIssuePrescription = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    if (!prescribingFor) return;

    try {
      const newPrescription: Prescription = {
        id: Math.random().toString(36).substr(2, 9),
        patientId: prescribingFor.patientId,
        patientName: prescribingFor.patientName,
        consultantId: user.id,
        consultantName: user.name,
        medications: prescriptionData.medications,
        dosage: prescriptionData.dosage,
        date: new Date().toLocaleDateString(),
        status: 'sent_to_pharmacy',
      };

      /*
       * Save prescription locally.
       *
       * This preserves your current ClinicalAPI implementation.
       */
      const allPrescriptions: Prescription[] = JSON.parse(
        localStorage.getItem('medi_prescriptions') || '[]'
      );

      await ClinicalAPI.savePrescriptions([
        ...allPrescriptions,
        newPrescription,
      ]);

      /*
       * Mark report as vetted in PostgreSQL
       */
      await ClinicalAPI.reviewReport(
        prescribingFor.id,
        {
          status: 'vetted',
          consultantNote:
            'Report reviewed and prescription issued.',
          vettedBy: user.id,
        }
      );

      /*
       * Reload pending reports
       */
      const updatedReports = await ClinicalAPI.getReports({
        status: 'pending_review',
      });

      console.log(
        'UPDATED CONSULTANT REPORTS:',
        updatedReports
      );

      setReports(updatedReports);

      /*
       * Notify patient
       */
      await ClinicalAPI.addNotification(
        prescribingFor.patientId,
        'Prescription Issued',
        `Dr. ${user.name} has vetted your report and sent a prescription to the pharmacy.`
      );

      /*
       * Notify pharmacies
       */
      const registeredUsers: User[] = JSON.parse(
        localStorage.getItem('medi_registered_users') || '[]'
      );

      const pharmacies = registeredUsers.filter(
        (u) => u.role === UserRole.PHARMACY
      );

      for (const pharmacy of pharmacies) {
        await ClinicalAPI.addNotification(
          pharmacy.id,
          'New Prescription Received',
          `New prescription for ${prescribingFor.patientName}`
        );
      }

      /*
       * Reset UI
       */
      setPrescribingFor(null);
      setSelectedReport(null);
      setPatientData(null);

      setPrescriptionData({
        medications: '',
        dosage: '',
      });

      alert(
        'Prescription synchronized with Pharmacy Hub.'
      );
    } catch (error) {
      console.error(
        'Failed to issue prescription:',
        error
      );

      alert(
        error instanceof Error
          ? error.message
          : 'Failed to issue prescription'
      );
    }
  };

  /*
   * ============================================================
   * OPEN CHAT
   * ============================================================
   */

  const openChat = (thread: ChatThread) => {
    const otherId = thread.participants.find(
      (id) => id !== user.id
    );

    if (!otherId) return;

    const patientName =
      thread.lastMessage?.senderId === otherId
        ? thread.lastMessage.senderName
        : 'Patient';

    setSelectedPatient({
      id: otherId,
      name: patientName,
    });

    setIsCommOpen(true);
  };

  /*
   * ============================================================
   * CLEAR SELECTED REPORT
   * ============================================================
   */

  const closeReport = () => {
    setSelectedReport(null);
    setPatientData(null);
    setAiReportInsight('');
  };

  /*
   * ============================================================
   * RENDER
   * ============================================================
   */

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in duration-500">

      {/* ======================================================
          HEADER
      ====================================================== */}

      <div className="flex justify-between items-center mb-10">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">
            Dr. {user.name}
          </h1>

          <span className="inline-block mt-2 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">
            {user.specialty || 'Specialty not set'}
          </span>
        </div>

        <Link
          to="/consultant/profile"
          className="px-6 py-3 bg-slate-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-800 transition"
        >
          Profile & Settings
        </Link>
      </div>

      {/* ======================================================
          MAIN GRID
      ====================================================== */}

      <div className="grid lg:grid-cols-12 gap-8">

        {/* ====================================================
            LEFT COLUMN
        ==================================================== */}

        <div className="lg:col-span-5 space-y-8">

          {/* ==================================================
              VETTING QUEUE
          ================================================== */}

          <section className="bg-white rounded-[3rem] p-8 border border-slate-100 shadow-xl">
            <h2 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-6">
              Vetting Queue
            </h2>

            <div className="space-y-4">
              {reports.length > 0 ? (
                reports.map((report) => (
                  <div
                    key={report.id}
                    className="p-6 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between group hover:border-emerald-600 transition"
                  >
                    <div>
                      <p className="font-bold text-slate-900">
                        {report.patientName}
                      </p>

                      <p className="text-[10px] text-slate-500">
                        {report.fileName}
                      </p>
                    </div>

                    <button
                      onClick={() =>
                        handleVetReport(report)
                      }
                      className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest shadow-md hover:bg-emerald-700 transition"
                    >
                      Vet Report
                    </button>
                  </div>
                ))
              ) : (
                <div className="text-center py-10 text-slate-400 text-sm italic">
                  No reports pending vetting.
                </div>
              )}
            </div>
          </section>

          {/* ==================================================
              ACTIVE CHAT SESSIONS
          ================================================== */}

          <section className="bg-white rounded-[3rem] p-8 border border-slate-100 shadow-xl">
            <h2 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-6">
              Patient Consultations (Chat)
            </h2>

            <div className="space-y-3">
              {activeThreads.length > 0 ? (
                activeThreads.map((thread) => (
                  <button
                    key={thread.chatId}
                    onClick={() => openChat(thread)}
                    className="w-full flex items-center justify-between p-5 bg-slate-50 border border-slate-100 rounded-2xl hover:bg-white hover:border-emerald-600 transition group text-left"
                  >
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900 text-sm">
                        {thread.lastMessage?.senderId !== user.id
                          ? thread.lastMessage?.senderName
                          : 'Patient Session'}
                      </p>

                      <p className="text-[9px] text-slate-400 font-medium truncate max-w-[150px]">
                        {thread.lastMessage?.text ||
                          'Secure channel open'}
                      </p>
                    </div>

                    <div className="text-right ml-4">
                      <span className="text-[8px] font-black uppercase text-slate-300 block">
                        {thread.lastMessage?.time || 'Active'}
                      </span>
                    </div>
                  </button>
                ))
              ) : (
                <div className="text-center py-6 text-slate-400 text-xs italic">
                  No active chat sessions.
                </div>
              )}
            </div>
          </section>

          {/* ==================================================
              PATIENT APPOINTMENTS
          ================================================== */}

          <section className="bg-slate-900 rounded-[3rem] p-8 text-white shadow-2xl">
            <h2 className="text-xs font-black uppercase tracking-widest text-emerald-400 mb-6">
              Patient Appointments
            </h2>

            <div className="space-y-4">

              {appointments.filter(
                (appointment) =>
                  appointment.status !== 'cancelled'
              ).length > 0 ? (
                appointments
                  .filter(
                    (appointment) =>
                      appointment.status !== 'cancelled'
                  )
                  .map((appointment) => (
                    <div
                      key={appointment.id}
                      className="p-5 bg-white/5 rounded-2xl border border-white/5"
                    >
                      <div className="flex items-start justify-between gap-4">

                        <div>
                          <p className="font-bold text-white">
                            {appointment.patientName}
                          </p>

                          <p className="text-[10px] text-slate-400 mt-1">
                            {appointment.date}
                          </p>

                          <p className="text-[9px] text-emerald-400 mt-1">
                            {appointment.time}
                          </p>

                          <div className="flex flex-wrap gap-2 mt-3">

                            <span className="text-[8px] uppercase font-black px-2 py-1 rounded bg-white/10 text-slate-300">
                              {appointment.status}
                            </span>

                            <span className="text-[8px] uppercase font-black px-2 py-1 rounded bg-white/10 text-slate-300">
                              Payment:{' '}
                              {appointment.paymentStatus}
                            </span>

                          </div>

                          {appointment.notes && (
                            <p className="text-[9px] text-slate-400 mt-3 max-w-[220px]">
                              {appointment.notes}
                            </p>
                          )}
                        </div>

                        <button
                          onClick={() => {
                            setSelectedPatient({
                              id: appointment.patientId,
                              name: appointment.patientName,
                            });

                            setIsCommOpen(true);
                          }}
                          className="text-[9px] font-black uppercase text-emerald-400 underline whitespace-nowrap"
                        >
                          Open Session
                        </button>

                      </div>
                    </div>
                  ))
              ) : (
                <div className="text-center py-8 text-slate-500 text-xs">
                  No patient appointments.
                </div>
              )}

            </div>
          </section>

        </div>

        {/* ====================================================
            RIGHT COLUMN
        ==================================================== */}

        <div className="lg:col-span-7">

          {selectedReport ? (

            /* ==================================================
               SELECTED REPORT
            ================================================== */

            <div className="bg-white rounded-[3rem] p-10 border border-slate-100 shadow-xl space-y-8 animate-in zoom-in-95">

              {/* REPORT HEADER */}

              <div className="flex justify-between items-start border-b border-slate-50 pb-6">

                <div>
                  <h3 className="text-2xl font-black text-slate-900">
                    {selectedReport.patientName}
                  </h3>

                  <div className="flex items-center space-x-3 mt-2">

                    <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">
                      Clinical Review Active
                    </p>

                    <Link
                      to={`/profile/${selectedReport.patientId}`}
                      className="text-[8px] font-black uppercase tracking-widest text-emerald-600 hover:underline"
                    >
                      Full Medical History
                    </Link>

                  </div>
                </div>

                <button
                  onClick={closeReport}
                  className="text-slate-300 hover:text-slate-900 transition"
                  title="Close report"
                >
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="3"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>

              </div>

              {/* PATIENT EMERGENCY INFORMATION */}

              {patientData && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">
                      Emergency Protocol Contact
                    </p>

                    <p className="text-sm font-black text-slate-900">
                      {patientData.emergencyContactName ||
                        'N/A'}
                    </p>
                  </div>

                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">
                      Emergency Protocol Phone
                    </p>

                    <p className="text-sm font-black text-emerald-600">
                      {patientData.emergencyContactPhone ||
                        'N/A'}
                    </p>
                  </div>

                </div>
              )}

              {/* AI INSIGHTS */}

              <div className="p-8 bg-emerald-50 rounded-2xl border border-emerald-100">

                <h4 className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-4">
                  AI Clinical Insights
                </h4>

                {loadingAI ? (
                  <div className="flex items-center space-x-3 text-slate-400 italic">

                    <div className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>

                    <span>
                      Extracting medical patterns...
                    </span>

                  </div>
                ) : (
                  <p className="text-sm text-slate-700 italic leading-relaxed">
                    {aiReportInsight ||
                      'No clinical insight available.'}
                  </p>
                )}

              </div>

              {/* CONSULTANT DECISION */}

              <div className="space-y-6">

                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Consultant Decision
                </h4>

                <div className="flex flex-col sm:flex-row gap-4">

                  <button
                    onClick={() =>
                      setPrescribingFor(selectedReport)
                    }
                    className="flex-grow bg-emerald-600 text-white py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition"
                  >
                    Issue Prescription
                  </button>

                  <button
                    onClick={async () => {
                      try {
                        await ClinicalAPI.reviewReport(
                          selectedReport.id,
                          {
                            status: 'vetted',
                            consultantNote:
                              'Report reviewed and marked clear.',
                            vettedBy: user.id,
                          }
                        );

                        const updatedReports =
                          await ClinicalAPI.getReports({
                            status: 'pending_review',
                          });

                        setReports(updatedReports);
                        closeReport();

                        alert(
                          'Report marked as clear.'
                        );
                      } catch (error) {
                        console.error(
                          'Failed to clear report:',
                          error
                        );

                        alert(
                          error instanceof Error
                            ? error.message
                            : 'Failed to mark report as clear.'
                        );
                      }
                    }}
                    className="flex-grow bg-slate-900 text-white py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-800 transition"
                  >
                    Mark as Clear
                  </button>

                </div>
              </div>

            </div>

          ) : (

            /* ==================================================
               EMPTY REPORT STATE
            ================================================== */

            <div className="min-h-[600px] flex flex-col items-center justify-center p-20 text-center border-4 border-dashed border-slate-50 rounded-[4rem] text-slate-300">

              <svg
                className="w-20 h-20 mb-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>

              <h3 className="text-2xl font-black text-slate-400">
                Clinical Dashboard Active
              </h3>

              <p className="font-medium max-w-sm">
                Select a report from the vetting queue or
                an active session to begin clinical review.
              </p>

            </div>

          )}

        </div>
      </div>

      {/* ======================================================
          PRESCRIPTION MODAL
      ====================================================== */}

      {prescribingFor && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6 animate-in fade-in">

          <div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            onClick={() => setPrescribingFor(null)}
          ></div>

          <div className="relative w-full max-w-lg bg-white rounded-[3.5rem] p-10 shadow-2xl">

            <h3 className="text-3xl font-black text-slate-900 mb-6 tracking-tight">
              Prescription Pad
            </h3>

            <form
              onSubmit={handleIssuePrescription}
              className="space-y-6"
            >

              {/* PATIENT */}

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                  Patient
                </label>

                <p className="px-6 py-4 bg-slate-50 rounded-2xl font-bold text-slate-900">
                  {prescribingFor.patientName}
                </p>
              </div>

              {/* MEDICATIONS */}

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                  Medications
                </label>

                <textarea
                  required
                  value={prescriptionData.medications}
                  onChange={(e) =>
                    setPrescriptionData({
                      ...prescriptionData,
                      medications: e.target.value,
                    })
                  }
                  className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:border-emerald-600 h-24"
                  placeholder="Drug names & strengths..."
                />
              </div>

              {/* DOSAGE */}

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                  Dosage Instructions
                </label>

                <input
                  required
                  value={prescriptionData.dosage}
                  onChange={(e) =>
                    setPrescriptionData({
                      ...prescriptionData,
                      dosage: e.target.value,
                    })
                  }
                  className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:border-emerald-600"
                  placeholder="e.g. 1-0-1 for 7 days"
                />
              </div>

              {/* SUBMIT */}

              <button
                type="submit"
                className="w-full bg-emerald-600 text-white py-6 rounded-3xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-emerald-200 hover:bg-emerald-700 transition"
              >
                Broadcast to Pharmacy Hub
              </button>

            </form>
          </div>
        </div>
      )}

      {/* ======================================================
          COMMUNICATION OVERLAY
      ====================================================== */}

      {selectedPatient && (
        <CommunicationOverlay
          isOpen={isCommOpen}
          onClose={() => {
            setIsCommOpen(false);
            setSelectedPatient(null);
          }}
          currentUser={user}
          targetUser={{
            ...selectedPatient,
            role: 'Patient',
          }}
        />
      )}

    </div>
  );
};

export default ConsultantDashboard;