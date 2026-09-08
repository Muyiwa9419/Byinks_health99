import React, {
  useState,
  useEffect,
  useCallback,
} from 'react';

import {
  User,
  Prescription,
} from '../types.ts';

import { ClinicalAPI } from '../services/apiService.ts';

const PharmacyDashboard: React.FC<{
  user: User;
}> = ({ user }) => {
  const [prescriptions, setPrescriptions] =
    useState<Prescription[]>([]);

  const [dispatchers, setDispatchers] =
    useState<User[]>([]);

  const [selectedIds, setSelectedIds] =
    useState<string[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  const [lastUpdated, setLastUpdated] =
    useState<Date | null>(null);

  /**
   * =========================================================
   * LOAD DATA
   * =========================================================
   */

  const fetchData = useCallback(
    async () => {
      try {
        setError(null);

        console.log(
          '================================================='
        );

        console.log(
          '[PHARMACY DASHBOARD] Loading data'
        );

        console.log(
          '[PHARMACY DASHBOARD] User:',
          {
            id: user.id,
            name: user.name,
            role: user.role,
          }
        );

        /**
         * ---------------------------------------------------
         * GET PRESCRIPTIONS FROM BACKEND
         * ---------------------------------------------------
         *
         * IMPORTANT:
         *
         * Do NOT send pharmacyId here.
         *
         * The backend determines what this pharmacy is
         * allowed to see based on the authenticated user.
         */

        const allPrescriptions =
          await ClinicalAPI.getPrescriptions();

        console.log(
          '[PHARMACY DASHBOARD] API RESPONSE:',
          allPrescriptions
        );

        console.log(
          '[PHARMACY DASHBOARD] API RESPONSE COUNT:',
          allPrescriptions?.length ?? 0
        );

        /**
         * ---------------------------------------------------
         * SHOW ALL VALID PHARMACY WORKFLOW STATUSES
         * ---------------------------------------------------
         *
         * At this stage we intentionally do the filtering
         * here only for statuses that belong in the pharmacy
         * dashboard.
         *
         * The backend has already handled ownership/security.
         */

        const pharmacyPrescriptions =
          (allPrescriptions || []).filter(
            (prescription) =>
              [
                'sent_to_pharmacy',
                'preparing',
                'ready_for_dispatch',
              ].includes(
                prescription.status
              )
          );

        console.log(
          '[PHARMACY DASHBOARD] FILTERED PRESCRIPTIONS:',
          pharmacyPrescriptions
        );

        console.log(
          '[PHARMACY DASHBOARD] FILTERED COUNT:',
          pharmacyPrescriptions.length
        );

        /**
         * ---------------------------------------------------
         * GET VERIFIED DISPATCHERS
         * ---------------------------------------------------
         */

        let verifiedDispatchers: User[] =
          [];

        try {
          verifiedDispatchers =
            await ClinicalAPI.getDispatchers();

          console.log(
            '[PHARMACY DASHBOARD] VERIFIED DISPATCHERS:',
            verifiedDispatchers
          );
        } catch (dispatcherError) {
          console.error(
            '[PHARMACY DASHBOARD] DISPATCHER LOAD ERROR:',
            dispatcherError
          );

          /**
           * Dispatcher failure should NOT prevent
           * prescriptions from appearing.
           */

          verifiedDispatchers = [];
        }

        /**
         * ---------------------------------------------------
         * UPDATE STATE
         * ---------------------------------------------------
         */

        setPrescriptions(
          pharmacyPrescriptions
        );

        setDispatchers(
          verifiedDispatchers
        );

        setLastUpdated(
          new Date()
        );

        console.log(
          '[PHARMACY DASHBOARD] STATE UPDATED'
        );

        console.log(
          '================================================='
        );
      } catch (loadError) {
        console.error(
          '[PHARMACY DASHBOARD] LOAD ERROR:',
          loadError
        );

        const message =
          loadError instanceof Error
            ? loadError.message
            : 'Failed to load pharmacy data.';

        setError(message);
      } finally {
        setLoading(false);
      }
    },
    [user.id, user.name, user.role]
  );

  /**
   * =========================================================
   * INITIAL LOAD + AUTO REFRESH
   * =========================================================
   */

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      if (!mounted) return;

      await fetchData();
    };

    run();

    const timer =
      window.setInterval(() => {
        if (mounted) {
          fetchData();
        }
      }, 5000);

    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, [fetchData]);

  /**
   * =========================================================
   * UPDATE SINGLE PRESCRIPTION
   * =========================================================
   */

  const handleUpdateStatus = async (
    id: string,
    status: Prescription['status']
  ) => {
    try {
      const prescription =
        prescriptions.find(
          (p) => p.id === id
        );

      if (!prescription) {
        alert(
          'Prescription could not be found.'
        );

        return;
      }

      console.log(
        '[PHARMACY] Updating prescription:',
        {
          id,
          currentStatus:
            prescription.status,
          newStatus: status,
          pharmacyId: user.id,
        }
      );

      const updated =
        await ClinicalAPI.updatePrescriptionStatus(
          id,
          {
            status,
            pharmacyId: user.id,
          }
        );

      console.log(
        '[PHARMACY] Prescription updated:',
        updated
      );

      /**
       * Update UI immediately.
       */

      setPrescriptions((current) =>
        current
          .map((p) =>
            p.id === updated.id
              ? updated
              : p
          )
          .filter((p) =>
            [
              'sent_to_pharmacy',
              'preparing',
              'ready_for_dispatch',
            ].includes(
              p.status
            )
          )
      );

      /**
       * Notify patient.
       */

      let message =
        `Prescription status updated to ${String(
          status
        ).replaceAll(
          '_',
          ' '
        )}.`;

      if (
        status === 'preparing'
      ) {
        message =
          'Pharmacy has started preparing your medication.';
      }

      if (
        status ===
        'ready_for_dispatch'
      ) {
        message =
          'Your medication is ready and awaiting logistics pickup.';
      }

      await ClinicalAPI.addNotification(
        prescription.patientId,
        'Pharmacy Update',
        message
      );
    } catch (updateError) {
      console.error(
        '[PHARMACY] UPDATE ERROR:',
        updateError
      );

      alert(
        updateError instanceof Error
          ? updateError.message
          : 'Failed to update prescription status.'
      );
    }
  };

  /**
   * =========================================================
   * BULK UPDATE
   * =========================================================
   */

  const handleBulkUpdateStatus =
    async (
      status: Prescription['status']
    ) => {
      if (
        selectedIds.length === 0
      ) {
        return;
      }

      try {
        let updatedCount = 0;

        for (
          const id of selectedIds
        ) {
          const prescription =
            prescriptions.find(
              (p) => p.id === id
            );

          if (!prescription) {
            continue;
          }

          const currentStatus =
            prescription.status;

          const validTransition =
            (
              status ===
                'preparing' &&
              currentStatus ===
                'sent_to_pharmacy'
            ) ||
            (
              status ===
                'ready_for_dispatch' &&
              currentStatus ===
                'preparing'
            );

          if (!validTransition) {
            continue;
          }

          const updated =
            await ClinicalAPI.updatePrescriptionStatus(
              id,
              {
                status,
                pharmacyId: user.id,
              }
            );

          updatedCount++;

          const message =
            status ===
            'preparing'
              ? 'Pharmacy has started preparing your medication.'
              : 'Your medication is ready and awaiting logistics pickup.';

          await ClinicalAPI.addNotification(
            prescription.patientId,
            'Pharmacy Update',
            message
          );

          setPrescriptions(
            (current) =>
              current.map((p) =>
                p.id === updated.id
                  ? updated
                  : p
              )
          );
        }

        setSelectedIds([]);

        if (
          updatedCount > 0
        ) {
          alert(
            `Batch Action: ${updatedCount} prescriptions updated successfully.`
          );
        } else {
          alert(
            'Selected items cannot undergo the requested status transition.'
          );
        }
      } catch (bulkError) {
        console.error(
          '[PHARMACY] BULK UPDATE ERROR:',
          bulkError
        );

        alert(
          bulkError instanceof Error
            ? bulkError.message
            : 'Failed to update selected prescriptions.'
        );
      }
    };

  /**
   * =========================================================
   * SELECT PRESCRIPTION
   * =========================================================
   */

  const toggleSelect = (
    id: string
  ) => {
    setSelectedIds((previous) =>
      previous.includes(id)
        ? previous.filter(
            (item) =>
              item !== id
          )
        : [
            ...previous,
            id,
          ]
    );
  };

  /**
   * =========================================================
   * SELECT ALL
   * =========================================================
   */

  const toggleSelectAll = () => {
    if (
      prescriptions.length === 0
    ) {
      return;
    }

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

  /**
   * =========================================================
   * ASSIGN DISPATCHER
   * =========================================================
   */

  const assignDispatch = async (
    prescription: Prescription,
    dispatcherId: string
  ) => {
    if (!dispatcherId) {
      return;
    }

    try {
      /**
       * Find dispatcher.
       */

      const dispatcher =
        dispatchers.find(
          (d) =>
            d.id === dispatcherId
        );

      if (!dispatcher) {
        alert(
          'The selected dispatch partner is no longer verified.'
        );

        return;
      }

      console.log(
        '[PHARMACY] Assigning delivery:',
        {
          prescriptionId:
            prescription.id,
          dispatcherId,
          pharmacyId:
            user.id,
        }
      );

      /**
       * ---------------------------------------------------
       * GET PATIENT
       * ---------------------------------------------------
       */

      const patient =
        await ClinicalAPI.getProfile(
          prescription.patientId
        );

      /**
       * ---------------------------------------------------
       * CREATE DELIVERY
       * ---------------------------------------------------
       */

      const delivery =
        await ClinicalAPI.createDelivery({
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

          patientAddress:
            patient?.address ||
            'Clinical Destination Hub',

          patientLocation:
            patient?.location,
        });

      console.log(
        '[PHARMACY] DELIVERY CREATED:',
        delivery
      );

      /**
       * ---------------------------------------------------
       * MARK PRESCRIPTION DISPATCHED
       * ---------------------------------------------------
       */

      const updatedPrescription =
        await ClinicalAPI.updatePrescriptionStatus(
          prescription.id,
          {
            status:
              'dispatched',
            pharmacyId:
              user.id,
          }
        );

      console.log(
        '[PHARMACY] PRESCRIPTION DISPATCHED:',
        updatedPrescription
      );

      /**
       * ---------------------------------------------------
       * REMOVE FROM PHARMACY QUEUE
       * ---------------------------------------------------
       */

      setPrescriptions(
        (current) =>
          current.filter(
            (p) =>
              p.id !==
              prescription.id
          )
      );

      /**
       * ---------------------------------------------------
       * NOTIFY DISPATCHER
       * ---------------------------------------------------
       */

      await ClinicalAPI.addNotification(
        dispatcherId,
        'Pickup Required',
        `New medication delivery assigned for ${prescription.patientName}.`
      );

      /**
       * ---------------------------------------------------
       * NOTIFY PATIENT
       * ---------------------------------------------------
       */

      await ClinicalAPI.addNotification(
        prescription.patientId,
        'Dispatched for Delivery',
        `Your medication has been assigned to ${dispatcher.name} and is ready for delivery.`
      );

      alert(
        `Success: Delivery assigned to ${dispatcher.name}.`
      );
    } catch (dispatchError) {
      console.error(
        '[PHARMACY] DISPATCH ERROR:',
        dispatchError
      );

      alert(
        dispatchError instanceof Error
          ? dispatchError.message
          : 'Failed to assign dispatch partner.'
      );
    }
  };

  /**
   * =========================================================
   * UI
   * =========================================================
   */

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in duration-500">

      {/* ===================================================
          HEADER
      =================================================== */}

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

          {/* DEBUG / CONNECTION STATUS */}

          <div className="mt-4 text-[9px] font-bold uppercase tracking-widest text-slate-400">
            Pharmacy ID: {user.id}
          </div>

          {lastUpdated && (
            <div className="mt-1 text-[9px] font-bold uppercase tracking-widest text-slate-300">
              Last synchronized:{' '}
              {lastUpdated.toLocaleTimeString()}
            </div>
          )}
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

      {/* ===================================================
          ERROR
      =================================================== */}

      {error && (
        <div className="mb-8 p-6 bg-red-50 border border-red-200 rounded-3xl">

          <p className="text-[10px] font-black uppercase tracking-widest text-red-500 mb-2">
            Pharmacy API Error
          </p>

          <p className="text-sm font-bold text-red-800">
            {error}
          </p>

          <button
            onClick={fetchData}
            className="mt-4 px-5 py-3 bg-red-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest"
          >
            Retry Connection
          </button>

        </div>
      )}

      {/* ===================================================
          MAIN
      =================================================== */}

      <section className="bg-white rounded-[3.5rem] p-8 md:p-12 border border-slate-100 shadow-2xl relative">

        {/* =================================================
            BULK ACTION BAR
        ================================================= */}

        {selectedIds.length > 0 && (

          <div className="sticky top-0 z-20 mb-8 p-6 bg-slate-900 rounded-3xl border border-white/10 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-6">

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

        {/* =================================================
            TITLE
        ================================================= */}

        <div className="flex items-center justify-between mb-10 border-b border-slate-50 pb-8">

          <div className="flex items-center space-x-6">

            <h2 className="text-2xl font-black text-slate-900 tracking-tight">
              Incoming Prescriptions
            </h2>

            <button
              onClick={toggleSelectAll}
              disabled={
                prescriptions.length === 0
              }
              className="text-[9px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 px-3 py-1 rounded-lg hover:bg-emerald-100 transition disabled:opacity-40"
            >
              {selectedIds.length ===
                prescriptions.length &&
              prescriptions.length > 0
                ? 'Deselect All'
                : 'Select All'}
            </button>

          </div>

          <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">
            {prescriptions.length}{' '}
            Pending Actions
          </span>

        </div>

        {/* =================================================
            LOADING
        ================================================= */}

        {loading && (
          <div className="text-center py-24">

            <div className="w-12 h-12 border-4 border-slate-200 border-t-emerald-600 rounded-full animate-spin mx-auto mb-6" />

            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Synchronizing Clinical Fulfillment Queue...
            </p>

          </div>
        )}

        {/* =================================================
            PRESCRIPTIONS
        ================================================= */}

        {!loading && (
          <div className="space-y-6">

            {prescriptions.length > 0 ? (

              prescriptions.map(
                (p) => (

                  <div
                    key={p.id}
                    className={`p-8 border rounded-[2.5rem] flex flex-col lg:flex-row justify-between items-start lg:items-center gap-10 group transition-all duration-300 ${
                      selectedIds.includes(
                        p.id
                      )
                        ? 'bg-emerald-50 border-emerald-500 shadow-xl'
                        : 'bg-slate-50 border-slate-100 hover:bg-white hover:border-emerald-500 hover:shadow-xl'
                    }`}
                  >

                    {/* PRESCRIPTION INFO */}

                    <div className="flex-grow space-y-4">

                      <div className="flex items-center space-x-4">

                        <button
                          onClick={() =>
                            toggleSelect(
                              p.id
                            )
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
                          {p.patientName
                            ?.charAt(0)
                            ?.toUpperCase() ||
                            'P'}
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

                      {/* MEDICATION */}

                      <div
                        className={`p-6 rounded-2xl border text-sm italic font-medium ${
                          selectedIds.includes(
                            p.id
                          )
                            ? 'bg-white border-emerald-200 text-emerald-900'
                            : 'bg-emerald-50/50 border-emerald-100 text-slate-700'
                        }`}
                      >

                        <span className="block font-black uppercase text-[9px] tracking-widest mb-1 text-emerald-700">
                          Medication Protocol:
                        </span>

                        {p.medications}{' '}
                        — {p.dosage}

                      </div>

                      {/* CONSULTANT */}

                      {p.consultantName && (
                        <div className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                          Prescribed by:{' '}
                          <span className="text-slate-700">
                            {p.consultantName}
                          </span>
                        </div>
                      )}

                    </div>

                    {/* ACTIONS */}

                    <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto shrink-0">

                      {/* PREPARING */}

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

                      {/* READY */}

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

                      {/* DISPATCH */}

                      {p.status ===
                        'ready_for_dispatch' && (

                        <div className="flex items-center space-x-3 w-full sm:w-72">

                          <select
                            disabled={
                              dispatchers.length ===
                              0
                            }
                            defaultValue=""
                            onChange={(event) =>
                              assignDispatch(
                                p,
                                event.target
                                  .value
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
                              (dispatcher) => (

                                <option
                                  key={
                                    dispatcher.id
                                  }
                                  value={
                                    dispatcher.id
                                  }
                                >
                                  {
                                    dispatcher.name
                                  }
                                </option>

                              )
                            )}

                          </select>

                        </div>

                      )}

                      {/* STATUS */}

                      <div className="px-6 py-5 bg-slate-200/50 text-slate-500 rounded-2xl text-[9px] font-black uppercase tracking-widest flex items-center justify-center min-w-[150px]">

                        {String(
                          p.status
                        ).replaceAll(
                          '_',
                          ' '
                        )}

                      </div>

                    </div>

                  </div>

                )
              )

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
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
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

                <button
                  onClick={fetchData}
                  className="mt-6 px-6 py-3 bg-slate-900 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-emerald-600 transition"
                >
                  Synchronize Now
                </button>

              </div>

            )}

          </div>
        )}

      </section>

    </div>
  );
};

export default PharmacyDashboard;