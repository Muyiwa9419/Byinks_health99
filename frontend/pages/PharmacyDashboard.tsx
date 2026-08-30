import React, { useState, useEffect } from 'react';
import {
  User,
  UserRole,
  Prescription,
  DeliveryOrder,
} from '../types.ts';
import { ClinicalAPI } from '../services/apiService.ts';

const PharmacyDashboard: React.FC<{ user: User }> = ({ user }) => {
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [dispatchers, setDispatchers] = useState<User[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  /*
   * ---------------------------------------------------------
   * LOAD PHARMACY DATA
   * ---------------------------------------------------------
   *
   * Prescriptions are currently stored locally by the
   * existing application workflow.
   *
   * Dispatch users are loaded from the backend/database.
   * This is important because admin approval changes the
   * PostgreSQL user record, not necessarily localStorage.
   */
  useEffect(() => {
    const fetchData = async () => {
      try {
        /*
         * ---------------------------------------------------
         * PRESCRIPTIONS
         * ---------------------------------------------------
         */

        const allP: Prescription[] = JSON.parse(
          localStorage.getItem('medi_prescriptions') || '[]'
        );

        const filtered = allP.filter((p) =>
          [
            'sent_to_pharmacy',
            'preparing',
            'ready_for_dispatch',
          ].includes(p.status)
        );

        setPrescriptions(filtered);

        /*
         * ---------------------------------------------------
         * VERIFIED DISPATCH USERS
         * ---------------------------------------------------
         *
         * IMPORTANT:
         * Get users from PostgreSQL instead of localStorage.
         */

        const allUsers = await ClinicalAPI.getAllUsers();

        console.log(
          'PHARMACY - ALL USERS FROM DATABASE:',
          allUsers
        );

        const verifiedDispatchers = allUsers.filter(
          (u) =>
            u.role === UserRole.DISPATCH &&
            u.isApproved === true
        );

        console.log(
          'PHARMACY - VERIFIED DISPATCHERS:',
          verifiedDispatchers
        );

        setDispatchers(verifiedDispatchers);
      } catch (error) {
        console.error(
          'PHARMACY DASHBOARD LOAD ERROR:',
          error
        );
      }
    };

    fetchData();

    window.addEventListener(
      'storage',
      fetchData
    );

    return () => {
      window.removeEventListener(
        'storage',
        fetchData
      );
    };
  }, []);

  /*
   * ---------------------------------------------------------
   * UPDATE SINGLE PRESCRIPTION STATUS
   * ---------------------------------------------------------
   */

  const handleUpdateStatus = (
    id: string,
    status: Prescription['status']
  ) => {
    try {
      const allP: Prescription[] = JSON.parse(
        localStorage.getItem(
          'medi_prescriptions'
        ) || '[]'
      );

      const idx = allP.findIndex(
        (p) => p.id === id
      );

      if (idx === -1) {
        alert(
          'Prescription could not be found.'
        );
        return;
      }

      allP[idx].status = status;
      allP[idx].pharmacyId = user.id;

      ClinicalAPI.savePrescriptions(allP);

      const msg =
        status === 'preparing'
          ? 'Pharmacy has started preparing your medication.'
          : status === 'ready_for_dispatch'
          ? 'Your medication is ready and awaiting logistics pickup.'
          : `Prescription status updated to ${(status as string).replace(
              '_',
              ' '
            )}.`;

      ClinicalAPI.addNotification(
        allP[idx].patientId,
        'Pharmacy Update',
        msg
      );

      /*
       * Update screen immediately.
       */

      setPrescriptions(
        allP.filter((p) =>
          [
            'sent_to_pharmacy',
            'preparing',
            'ready_for_dispatch',
          ].includes(p.status)
        )
      );
    } catch (error) {
      console.error(
        'Failed to update prescription:',
        error
      );

      alert(
        'Failed to update prescription status.'
      );
    }
  };

  /*
   * ---------------------------------------------------------
   * BULK UPDATE PRESCRIPTIONS
   * ---------------------------------------------------------
   */

  const handleBulkUpdateStatus = (
    status: Prescription['status']
  ) => {
    if (selectedIds.length === 0) {
      return;
    }

    try {
      const allP: Prescription[] = JSON.parse(
        localStorage.getItem(
          'medi_prescriptions'
        ) || '[]'
      );

      let updatedCount = 0;

      selectedIds.forEach((id) => {
        const idx = allP.findIndex(
          (p) => p.id === id
        );

        if (idx > -1) {
          const currentStatus =
            allP[idx].status;

          if (
            (
              status === 'preparing' &&
              currentStatus === 'sent_to_pharmacy'
            ) ||
            (
              status === 'ready_for_dispatch' &&
              currentStatus === 'preparing'
            )
          ) {
            allP[idx].status = status;
            allP[idx].pharmacyId = user.id;

            updatedCount++;

            const msg =
              status === 'preparing'
                ? 'Pharmacy has started preparing your medication.'
                : status === 'ready_for_dispatch'
                ? 'Your medication is ready and awaiting logistics pickup.'
                : `Prescription status updated to ${(status as string).replace(
                    '_',
                    ' '
                  )}.`;

            ClinicalAPI.addNotification(
              allP[idx].patientId,
              'Pharmacy Update',
              msg
            );
          }
        }
      });

      if (updatedCount > 0) {
        ClinicalAPI.savePrescriptions(
          allP
        );

        setSelectedIds([]);

        setPrescriptions(
          allP.filter((p) =>
            [
              'sent_to_pharmacy',
              'preparing',
              'ready_for_dispatch',
            ].includes(p.status)
          )
        );

        alert(
          `Batch Action: ${updatedCount} prescriptions updated successfully.`
        );
      } else {
        alert(
          'Selected items cannot undergo the requested status transition.'
        );
      }
    } catch (error) {
      console.error(
        'Bulk prescription update failed:',
        error
      );

      alert(
        'Failed to update selected prescriptions.'
      );
    }
  };

  /*
   * ---------------------------------------------------------
   * SELECT PRESCRIPTION
   * ---------------------------------------------------------
   */

  const toggleSelect = (
    id: string
  ) => {
    setSelectedIds((prev) =>
      prev.includes(id)
        ? prev.filter(
            (i) => i !== id
          )
        : [...prev, id]
    );
  };

  /*
   * ---------------------------------------------------------
   * SELECT ALL
   * ---------------------------------------------------------
   */

  const toggleSelectAll = () => {
    if (
      selectedIds.length ===
      prescriptions.length
    ) {
      setSelectedIds([]);
    } else {
      setSelectedIds(
        prescriptions.map(
          (p) => p.id
        )
      );
    }
  };

  /*
   * ---------------------------------------------------------
   * ASSIGN DISPATCHER
   * ---------------------------------------------------------
   *
   * IMPORTANT:
   * This function now gets the dispatcher from the
   * PostgreSQL-backed user list instead of localStorage.
   */

  const assignDispatch = async (
    prescription: Prescription,
    dispatcherId: string
  ) => {
    if (!dispatcherId) {
      return;
    }

    try {
      /*
       * Get current users from backend.
       */

      const allUsers =
        await ClinicalAPI.getAllUsers();

      const dispatcher =
        allUsers.find(
          (u) =>
            u.id === dispatcherId &&
            u.role === UserRole.DISPATCH &&
            u.isApproved === true
        );

      if (!dispatcher) {
        alert(
          'The selected dispatch partner is no longer available or has not been verified.'
        );
        return;
      }

      /*
       * Get patient information.
       */

      const patient =
        allUsers.find(
          (u) =>
            u.id ===
            prescription.patientId
        );

      /*
       * Mark prescription as dispatched.
       */

      const allP: Prescription[] =
        JSON.parse(
          localStorage.getItem(
            'medi_prescriptions'
          ) || '[]'
        );

      const prescriptionIndex =
        allP.findIndex(
          (p) =>
            p.id ===
            prescription.id
        );

      if (
        prescriptionIndex === -1
      ) {
        alert(
          'Prescription could not be found.'
        );
        return;
      }

      allP[
        prescriptionIndex
      ].status = 'dispatched';

      allP[
        prescriptionIndex
      ].pharmacyId = user.id;

      ClinicalAPI.savePrescriptions(
        allP
      );

      /*
       * -----------------------------------------------------
       * CREATE DELIVERY ORDER
       * -----------------------------------------------------
       */

      const newDelivery: DeliveryOrder =
        {
          id:
            Math.random()
              .toString(36)
              .substr(2, 9),

          prescriptionId:
            prescription.id,

          patientId:
            prescription.patientId,

          patientName:
            prescription.patientName,

          medications:
            prescription.medications,

          dosage:
            prescription.dosage,

          pharmacyId:
            user.id,

          dispatchId:
            dispatcherId,

          status:
            'assigned',

          patientAddress:
            patient?.address ||
            'Clinical Destination Hub',

          patientLocation:
            patient?.location,

          timestamp:
            new Date().toISOString(),
        };

      const allD =
        JSON.parse(
          localStorage.getItem(
            'medi_deliveries'
          ) || '[]'
        );

      ClinicalAPI.saveDeliveries([
        ...allD,
        newDelivery,
      ]);

      /*
       * -----------------------------------------------------
       * NOTIFICATIONS
       * -----------------------------------------------------
       */

      await ClinicalAPI.addNotification(
        dispatcherId,
        'Pickup Required',
        `New medication delivery assigned for ${prescription.patientName}`
      );

      await ClinicalAPI.addNotification(
        prescription.patientId,
        'Dispatched for Delivery',
        `Your medications have been handed to ${dispatcher.name} and are on the way.`
      );

      /*
       * Refresh visible prescriptions.
       */

      setPrescriptions(
        allP.filter((p) =>
          [
            'sent_to_pharmacy',
            'preparing',
            'ready_for_dispatch',
          ].includes(p.status)
        )
      );

      alert(
        `Success: Logistics protocol initialized with ${dispatcher.name}`
      );
    } catch (error) {
      console.error(
        'DISPATCH ASSIGNMENT ERROR:',
        error
      );

      alert(
        error instanceof Error
          ? error.message
          : 'Failed to assign dispatch partner.'
      );
    }
  };

  /*
   * ---------------------------------------------------------
   * UI
   * ---------------------------------------------------------
   */

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in duration-500">

      {/* HEADER */}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12 gap-6">

        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">
            {user.name}
          </h1>

          <div className="flex items-center space-x-3 mt-3">

            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600 bg-emerald-50 px-4 py-1.5 rounded-full border border-emerald-100">
              Fulfillment Hub Active
            </span>

            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 bg-slate-50 px-4 py-1.5 rounded-full">
              Node: L-75
            </span>

          </div>
        </div>

        <div className="flex items-center space-x-6">

          <div className="text-right">

            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
              Clinical Logistics Status
            </p>

            <p className="text-lg font-black text-slate-900">
              {dispatchers.length} Partners Available
            </p>

          </div>

          <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-white">

            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2.5"
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>

          </div>

        </div>

      </div>

      {/* MAIN */}

      <section className="bg-white rounded-[3.5rem] p-8 md:p-12 border border-slate-100 shadow-2xl relative">

        {/* BULK ACTION BAR */}

        {selectedIds.length > 0 && (

          <div className="sticky top-0 z-20 mb-8 p-6 bg-slate-900 rounded-3xl border border-white/10 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-6 animate-in slide-in-from-top-4">

            <div className="flex items-center space-x-4">

              <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center text-white font-black">
                {selectedIds.length}
              </div>

              <div>

                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400">
                  Items Selected
                </p>

                <p className="text-sm font-bold text-white">
                  Batch Clinical Protocol
                </p>

              </div>

            </div>

            <div className="flex items-center space-x-3">

              <button
                onClick={() =>
                  handleBulkUpdateStatus(
                    'preparing'
                  )
                }
                className="px-6 py-3 bg-white/10 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-emerald-600 transition"
              >
                Start Preparation
              </button>

              <button
                onClick={() =>
                  handleBulkUpdateStatus(
                    'ready_for_dispatch'
                  )
                }
                className="px-6 py-3 bg-emerald-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-emerald-700 transition"
              >
                Mark Ready
              </button>

              <button
                onClick={() =>
                  setSelectedIds([])
                }
                className="px-4 py-3 bg-white/5 text-slate-400 rounded-xl text-[9px] font-black uppercase tracking-widest hover:text-white transition"
              >
                Cancel
              </button>

            </div>

          </div>

        )}

        {/* TITLE */}

        <div className="flex items-center justify-between mb-10 border-b border-slate-50 pb-8">

          <div className="flex items-center space-x-6">

            <h2 className="text-2xl font-black text-slate-900 tracking-tight">
              Incoming Prescriptions
            </h2>

            <button
              onClick={toggleSelectAll}
              className="text-[9px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 px-3 py-1 rounded-lg hover:bg-emerald-100 transition"
            >
              {selectedIds.length ===
              prescriptions.length
                ? 'Deselect All'
                : 'Select All'}
            </button>

          </div>

          <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">
            {prescriptions.length} Pending Actions
          </span>

        </div>

        {/* PRESCRIPTIONS */}

        <div className="space-y-6">

          {prescriptions.length > 0 ? (

            prescriptions.map((p) => (

              <div
                key={p.id}
                className={`p-8 border rounded-[2.5rem] flex flex-col lg:flex-row justify-between items-start lg:items-center gap-10 group transition-all duration-300 ${
                  selectedIds.includes(p.id)
                    ? 'bg-emerald-50 border-emerald-500 shadow-xl'
                    : 'bg-slate-50 border-slate-100 hover:bg-white hover:border-emerald-500 hover:shadow-xl'
                }`}
              >

                <div className="flex-grow space-y-4">

                  <div className="flex items-center space-x-4">

                    <button
                      onClick={() =>
                        toggleSelect(p.id)
                      }
                      className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
                        selectedIds.includes(
                          p.id
                        )
                          ? 'bg-emerald-600 border-emerald-600'
                          : 'bg-white border-slate-200'
                      }`}
                    >

                      {selectedIds.includes(
                        p.id
                      ) && (

                        <svg
                          className="w-4 h-4 text-white"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="4"
                            d="M5 13l4 4L19 7"
                          />
                        </svg>

                      )}

                    </button>

                    <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-slate-900 shadow-sm border border-slate-100 font-black">
                      {p.patientName.charAt(0)}
                    </div>

                    <div>

                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                        Patient Identity
                      </p>

                      <h3 className="text-xl font-black text-slate-900">
                        {p.patientName}
                      </h3>

                    </div>

                  </div>

                  <div
                    className={`p-6 rounded-2xl border text-sm italic font-medium transition-colors ${
                      selectedIds.includes(
                        p.id
                      )
                        ? 'bg-white border-emerald-200 text-emerald-900'
                        : 'bg-emerald-50/50 border-emerald-100 text-slate-700'
                    }`}
                  >

                    <span
                      className={`block font-black uppercase text-[9px] tracking-widest mb-1 ${
                        selectedIds.includes(
                          p.id
                        )
                          ? 'text-emerald-600'
                          : 'text-emerald-700'
                      }`}
                    >
                      Medication Protocol:
                    </span>

                    {p.medications} — {p.dosage}

                  </div>

                </div>

                {/* ACTIONS */}

                <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto shrink-0">

                  {p.status ===
                    'sent_to_pharmacy' && (

                    <button
                      onClick={() =>
                        handleUpdateStatus(
                          p.id,
                          'preparing'
                        )
                      }
                      className="px-10 py-5 bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition shadow-xl shadow-emerald-100"
                    >
                      Establish Prep Node
                    </button>

                  )}

                  {p.status ===
                    'preparing' && (

                    <button
                      onClick={() =>
                        handleUpdateStatus(
                          p.id,
                          'ready_for_dispatch'
                        )
                      }
                      className="px-10 py-5 bg-amber-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-amber-600 transition shadow-xl shadow-amber-100"
                    >
                      Authorize Dispatch
                    </button>

                  )}

                  {p.status ===
                    'ready_for_dispatch' && (

                    <div className="flex items-center space-x-3 w-full sm:w-64">

                      <select
                        disabled={
                          dispatchers.length ===
                          0
                        }
                        onChange={(e) =>
                          assignDispatch(
                            p,
                            e.target.value
                          )
                        }
                        className="w-full px-8 py-5 bg-white border-2 border-slate-200 rounded-2xl text-[10px] font-black uppercase tracking-widest outline-none focus:border-emerald-600 shadow-sm appearance-none disabled:bg-slate-50 disabled:text-slate-400"
                      >

                        <option value="">
                          {dispatchers.length ===
                          0
                            ? 'No Verified Dispatchers'
                            : 'Assign Logistics Partner'}
                        </option>

                        {dispatchers.map(
                          (d) => (

                            <option
                              key={d.id}
                              value={d.id}
                            >
                              {d.name}
                            </option>

                          )
                        )}

                      </select>

                    </div>

                  )}

                  <div className="px-6 py-5 bg-slate-200/50 text-slate-500 rounded-2xl text-[9px] font-black uppercase tracking-widest flex items-center justify-center min-w-[120px]">

                    {(p.status as string).replace(
                      '_',
                      ' '
                    )}

                  </div>

                </div>

              </div>

            ))

          ) : (

            <div className="text-center py-24 bg-slate-50/50 rounded-[4rem] border-4 border-dashed border-slate-100">

              <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-6 text-slate-200 shadow-sm">

                <svg
                  className="w-10 h-10"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2.5"
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>

              </div>

              <h3 className="text-xl font-black text-slate-900 tracking-tight">
                Fulfillment Queue Clear
              </h3>

              <p className="text-slate-400 font-medium text-sm mt-1 uppercase tracking-widest text-[10px]">
                Monitoring incoming clinical broadcasts...
              </p>

            </div>

          )}

        </div>

      </section>

    </div>
  );
};

export default PharmacyDashboard;