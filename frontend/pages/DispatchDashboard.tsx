import React, { useState, useEffect, useRef } from 'react';
import { User, DeliveryOrder } from '../types.ts';
import { ClinicalAPI } from '../services/apiService.ts';

// Leaflet is loaded globally through CDN
declare const L: any;

const DispatchDashboard: React.FC<{ user: User }> = ({ user }) => {
  const [deliveries, setDeliveries] = useState<DeliveryOrder[]>([]);
  const [myLocation, setMyLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);

  const [isOnline, setIsOnline] = useState(
    user.isOnline ?? true
  );

  const [focusedDeliveryId, setFocusedDeliveryId] =
    useState<string | null>(null);

  const [loadingDeliveries, setLoadingDeliveries] =
    useState(true);

  const [deliveryError, setDeliveryError] =
    useState<string | null>(null);

  const mapRef = useRef<any>(null);
  const dispatcherMarkerRef = useRef<any>(null);

  const deliveryMarkersRef = useRef<
    Map<string, any>
  >(new Map());

  const routeLinesRef = useRef<
    Map<string, any>
  >(new Map());

  const mapContainerRef =
    useRef<HTMLDivElement>(null);

  /**
   * =========================================================
   * LOAD DELIVERIES
   * =========================================================
   *
   * IMPORTANT:
   *
   * We intentionally DO NOT send dispatchId here.
   *
   * The backend already knows that a DISPATCH user should
   * receive active deliveries:
   *
   * pending
   * assigned
   * in_transit
   *
   * This allows the dashboard to see a delivery even if the
   * pharmacy has created it but the assignment has not yet
   * reached this dispatcher.
   */
  useEffect(() => {
    let mounted = true;

    const fetchData = async () => {
      try {
        console.log(
          '================================================'
        );

        console.log(
          '[DISPATCH DASHBOARD] FETCHING DELIVERIES'
        );

        console.log(
          '[DISPATCH DASHBOARD] Dispatcher ID:',
          user.id
        );

        setDeliveryError(null);

        /**
         * Fetch all active deliveries available to a
         * dispatcher.
         *
         * Do NOT use:
         *
         * getDeliveries({ dispatchId: user.id })
         *
         * because that hides pending deliveries.
         */
        const backendDeliveries =
          await ClinicalAPI.getDeliveries();

        console.log(
          '[DISPATCH DASHBOARD] BACKEND RESPONSE:',
          backendDeliveries
        );

        console.log(
          '[DISPATCH DASHBOARD] BACKEND COUNT:',
          backendDeliveries?.length ?? 0
        );

        if (!Array.isArray(backendDeliveries)) {
          throw new Error(
            'Invalid delivery response from server'
          );
        }

        /**
         * -----------------------------------------------------
         * FILTER ACTIVE DELIVERIES
         * -----------------------------------------------------
         *
         * Show:
         *
         * 1. Pending deliveries
         * 2. Deliveries assigned to THIS dispatcher
         * 3. Deliveries currently in transit with THIS dispatcher
         *
         * We do not show delivered orders.
         */
        const activeDeliveries =
          backendDeliveries.filter((delivery) => {
            if (!delivery) {
              return false;
            }

            if (delivery.status === 'delivered') {
              return false;
            }

            /**
             * Pending = available dispatch work.
             */
            if (delivery.status === 'pending') {
              return true;
            }

            /**
             * Assigned/in transit = only if assigned
             * to the current dispatcher.
             */
            return (
              delivery.dispatchId === user.id
            );
          });

        console.log(
          '[DISPATCH DASHBOARD] ACTIVE DELIVERIES:',
          activeDeliveries
        );

        console.log(
          '[DISPATCH DASHBOARD] ACTIVE COUNT:',
          activeDeliveries.length
        );

        /**
         * Log individual delivery information.
         * This will make debugging much easier.
         */
        activeDeliveries.forEach((delivery) => {
          console.log(
            '[DISPATCH DASHBOARD] DELIVERY:',
            {
              id: delivery.id,
              patient: delivery.patientName,
              status: delivery.status,
              dispatchId: delivery.dispatchId,
              currentDispatcher: user.id,
              prescriptionId:
                delivery.prescriptionId,
            }
          );
        });

        if (mounted) {
          setDeliveries(activeDeliveries);
        }
      } catch (error: any) {
        console.error(
          '[DISPATCH DASHBOARD] DELIVERY LOAD ERROR:',
          error
        );

        if (mounted) {
          setDeliveries([]);

          setDeliveryError(
            error?.message ||
              'Unable to load delivery assignments'
          );
        }
      } finally {
        if (mounted) {
          setLoadingDeliveries(false);
        }
      }
    };

    /**
     * Initial load
     */
    fetchData();

    /**
     * Refresh every 5 seconds.
     *
     * This means a newly assigned delivery will appear
     * without needing to refresh the browser.
     */
    const refreshTimer = window.setInterval(
      fetchData,
      5000
    );

    /**
     * Also refresh when another browser tab/window
     * changes local storage.
     */
    const handleStorage = () => {
      fetchData();
    };

    window.addEventListener(
      'storage',
      handleStorage
    );

    return () => {
      mounted = false;

      window.clearInterval(refreshTimer);

      window.removeEventListener(
        'storage',
        handleStorage
      );
    };
  }, [user.id]);

  /**
   * =========================================================
   * LOCATION TRACKING
   * =========================================================
   */
  useEffect(() => {
    let mounted = true;

    const trackLocation = () => {
      /**
       * Don't request GPS while offline.
       */
      if (!isOnline) {
        return;
      }

      if (!navigator.geolocation) {
        console.error(
          '[DISPATCH DASHBOARD] Geolocation is not supported'
        );
        return;
      }

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          if (!mounted) {
            return;
          }

          const location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };

          console.log(
            '[DISPATCH DASHBOARD] CURRENT LOCATION:',
            location
          );

          setMyLocation(location);

          /**
           * Update dispatcher profile location.
           */
          try {
            await ClinicalAPI.updateUserStatus(
              user.id,
              {
                location,
              }
            );
          } catch (error) {
            console.error(
              '[DISPATCH DASHBOARD] LOCATION UPDATE ERROR:',
              error
            );
          }
        },
        (error) => {
          console.error(
            '[DISPATCH DASHBOARD] GEOLOCATION ERROR:',
            error
          );
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 5000,
        }
      );
    };

    /**
     * Initial location
     */
    trackLocation();

    /**
     * Update location every 5 seconds.
     */
    const geoTimer = window.setInterval(
      trackLocation,
      5000
    );

    return () => {
      mounted = false;
      window.clearInterval(geoTimer);
    };
  }, [user.id, isOnline]);

  /**
   * =========================================================
   * MAP INITIALIZATION
   * =========================================================
   */
  useEffect(() => {
    if (!mapContainerRef.current) {
      return;
    }

    if (mapRef.current) {
      return;
    }

    /**
     * Make sure Leaflet has loaded.
     */
    if (typeof L === 'undefined') {
      console.error(
        '[DISPATCH DASHBOARD] Leaflet L object not found'
      );
      return;
    }

    const initialView = myLocation
      ? [myLocation.lat, myLocation.lng]
      : [6.4674, 3.4070];

    mapRef.current = L.map(
      mapContainerRef.current,
      {
        zoomControl: false,
        attributionControl: false,
      }
    ).setView(initialView, 14);

    L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
      {
        maxZoom: 19,
      }
    ).addTo(mapRef.current);

    L.control
      .zoom({
        position: 'bottomright',
      })
      .addTo(mapRef.current);

    /**
     * Give Leaflet time to calculate container size.
     */
    setTimeout(() => {
      if (mapRef.current) {
        mapRef.current.invalidateSize();
      }
    }, 300);

    /**
     * Cleanup ONLY when component unmounts.
     */
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }

      dispatcherMarkerRef.current = null;

      deliveryMarkersRef.current.clear();
      routeLinesRef.current.clear();
    };
  }, []);

  /**
   * =========================================================
   * SYNC DISPATCHER MARKER
   * =========================================================
   */
  useEffect(() => {
    if (!mapRef.current) {
      return;
    }

    /**
     * Remove marker when offline.
     */
    if (!isOnline) {
      if (dispatcherMarkerRef.current) {
        dispatcherMarkerRef.current.remove();
        dispatcherMarkerRef.current = null;
      }

      return;
    }

    if (!myLocation) {
      return;
    }

    /**
     * Create marker.
     */
    if (!dispatcherMarkerRef.current) {
      const icon = L.divIcon({
        className: 'custom-div-icon',

        html: `
          <div class="relative">
            <div class="absolute -inset-4 bg-emerald-500/20 rounded-full animate-ping"></div>

            <div class="w-10 h-10 bg-emerald-600 rounded-2xl flex items-center justify-center text-white shadow-2xl border-4 border-white relative z-10">

              <svg
                class="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="3"
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>

            </div>
          </div>
        `,

        iconSize: [40, 40],
        iconAnchor: [20, 20],
      });

      dispatcherMarkerRef.current =
        L.marker(
          [
            myLocation.lat,
            myLocation.lng,
          ],
          { icon }
        ).addTo(mapRef.current);
    } else {
      dispatcherMarkerRef.current.setLatLng([
        myLocation.lat,
        myLocation.lng,
      ]);
    }
  }, [myLocation, isOnline]);

  /**
   * =========================================================
   * SYNC DELIVERY MARKERS AND ROUTES
   * =========================================================
   */
  useEffect(() => {
    if (!mapRef.current) {
      return;
    }

    if (!myLocation) {
      return;
    }

    /**
     * Current delivery IDs.
     */
    const activeDeliveryIds =
      new Set(
        deliveries.map(
          (delivery) => delivery.id
        )
      );

    /**
     * Remove markers for deliveries that no longer
     * exist in the active list.
     */
    deliveryMarkersRef.current.forEach(
      (marker, id) => {
        if (!activeDeliveryIds.has(id)) {
          marker.remove();

          deliveryMarkersRef.current.delete(
            id
          );
        }
      }
    );

    /**
     * Remove route lines for inactive deliveries.
     */
    routeLinesRef.current.forEach(
      (line, id) => {
        if (!activeDeliveryIds.has(id)) {
          line.remove();

          routeLinesRef.current.delete(
            id
          );
        }
      }
    );

    /**
     * -----------------------------------------------------
     * ADD / UPDATE DELIVERY MARKERS
     * -----------------------------------------------------
     */
    deliveries.forEach((delivery) => {
      /**
       * Use real patient coordinates if available.
       *
       * Otherwise use a small fallback point so the
       * delivery still appears visually.
       */
      const destLat =
        delivery.patientLocation?.lat ??
        myLocation.lat + 0.005;

      const destLng =
        delivery.patientLocation?.lng ??
        myLocation.lng + 0.005;

      const destination: [
        number,
        number
      ] = [
        destLat,
        destLng,
      ];

      /**
       * Delivery marker.
       */
      if (
        !deliveryMarkersRef.current.has(
          delivery.id
        )
      ) {
        const icon = L.divIcon({
          className: 'custom-div-icon',

          html: `
            <div class="w-8 h-8 bg-slate-900 rounded-xl flex items-center justify-center text-white shadow-xl border-2 border-white">

              <svg
                class="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2.5"
                  d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                />
              </svg>

            </div>
          `,

          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });

        const marker =
          L.marker(
            destination,
            { icon }
          )
            .addTo(mapRef.current)
            .bindPopup(`
              <div class="p-2 font-black text-[10px] uppercase tracking-widest text-slate-900">
                Patient: ${delivery.patientName}

                <br />

                <span class="text-slate-400">
                  #${delivery.id.substring(0, 5)}
                </span>

                <br />

                <span class="text-emerald-600">
                  Status: ${delivery.status.replace(
                    '_',
                    ' '
                  )}
                </span>
              </div>
            `);

        deliveryMarkersRef.current.set(
          delivery.id,
          marker
        );
      } else {
        const marker =
          deliveryMarkersRef.current.get(
            delivery.id
          );

        if (marker) {
          marker.setLatLng(destination);
        }
      }

      /**
       * -----------------------------------------------------
       * ROUTE LINE
       * -----------------------------------------------------
       */
      const routePoints = [
        [
          myLocation.lat,
          myLocation.lng,
        ],
        destination,
      ];

      if (
        !routeLinesRef.current.has(
          delivery.id
        )
      ) {
        const line =
          L.polyline(
            routePoints,
            {
              color:
                delivery.id ===
                focusedDeliveryId
                  ? '#10b981'
                  : '#cbd5e1',

              weight:
                delivery.id ===
                focusedDeliveryId
                  ? 6
                  : 3,

              opacity:
                delivery.id ===
                focusedDeliveryId
                  ? 0.8
                  : 0.4,

              dashArray:
                delivery.status ===
                'assigned'
                  ? '10, 10'
                  : 'none',
            }
          ).addTo(mapRef.current);

        routeLinesRef.current.set(
          delivery.id,
          line
        );
      } else {
        const line =
          routeLinesRef.current.get(
            delivery.id
          );

        if (line) {
          line.setLatLngs(routePoints);

          line.setStyle({
            color:
              delivery.id ===
              focusedDeliveryId
                ? '#10b981'
                : '#cbd5e1',

            weight:
              delivery.id ===
              focusedDeliveryId
                ? 6
                : 3,

            opacity:
              delivery.id ===
              focusedDeliveryId
                ? 0.8
                : 0.4,
          });
        }
      }
    });

    /**
     * -----------------------------------------------------
     * AUTO FOCUS
     * -----------------------------------------------------
     */
    if (
      focusedDeliveryId &&
      routeLinesRef.current.has(
        focusedDeliveryId
      )
    ) {
      const line =
        routeLinesRef.current.get(
          focusedDeliveryId
        );

      if (line) {
        mapRef.current.fitBounds(
          line.getBounds(),
          {
            padding: [100, 100],
            animate: true,
          }
        );
      }
    } else if (
      deliveries.length > 0 &&
      isOnline
    ) {
      const bounds =
        L.latLngBounds([
          myLocation.lat,
          myLocation.lng,
        ]);

      deliveries.forEach((delivery) => {
        const destLat =
          delivery.patientLocation?.lat ??
          myLocation.lat + 0.005;

        const destLng =
          delivery.patientLocation?.lng ??
          myLocation.lng + 0.005;

        bounds.extend([
          destLat,
          destLng,
        ]);
      });

      mapRef.current.fitBounds(
        bounds,
        {
          padding: [50, 50],
        }
      );
    }
  }, [
    deliveries,
    myLocation,
    isOnline,
    focusedDeliveryId,
  ]);

  /**
   * =========================================================
   * TOGGLE ONLINE STATUS
   * =========================================================
   */
  const toggleOnlineStatus =
    async () => {
      const newStatus = !isOnline;

      try {
        setIsOnline(newStatus);

        await ClinicalAPI.updateUserStatus(
          user.id,
          {
            isOnline: newStatus,
          }
        );

        /**
         * Keep local session synchronized.
         */
        try {
          const existingSession =
            JSON.parse(
              localStorage.getItem(
                'medi_local_session'
              ) || 'null'
            );

          if (
            existingSession &&
            existingSession.id === user.id
          ) {
            const updatedSession = {
              ...existingSession,
              isOnline: newStatus,
            };

            localStorage.setItem(
              'medi_local_session',
              JSON.stringify(
                updatedSession
              )
            );
          }
        } catch (storageError) {
          console.error(
            '[DISPATCH DASHBOARD] Session update error:',
            storageError
          );
        }
      } catch (error) {
        console.error(
          '[DISPATCH DASHBOARD] ONLINE STATUS ERROR:',
          error
        );

        /**
         * Revert UI if backend update failed.
         */
        setIsOnline(!newStatus);
      }
    };

  /**
   * =========================================================
   * UPDATE DELIVERY STATUS
   * =========================================================
   */
  const updateDeliveryStatus =
    async (
      id: string,
      status: DeliveryOrder['status']
    ) => {
      try {
        console.log(
          '[DISPATCH DASHBOARD] Updating delivery:',
          id,
          status
        );

        const updatedDelivery =
          await ClinicalAPI.updateDeliveryStatus(
            id,
            status
          );

        console.log(
          '[DISPATCH DASHBOARD] DELIVERY UPDATED:',
          updatedDelivery
        );

        /**
         * Remove delivered orders.
         */
        if (status === 'delivered') {
          setDeliveries(
            (current) =>
              current.filter(
                (delivery) =>
                  delivery.id !== id
              )
          );

          setFocusedDeliveryId(
            null
          );
        } else {
          /**
           * Update existing delivery.
           */
          setDeliveries(
            (current) =>
              current.map(
                (delivery) =>
                  delivery.id === id
                    ? updatedDelivery
                    : delivery
              )
          );
        }

        /**
         * Focus delivery when route starts.
         */
        if (
          status === 'in_transit'
        ) {
          setFocusedDeliveryId(id);
        }

        /**
         * Notify patient.
         */
        try {
          await ClinicalAPI.addNotification(
            updatedDelivery.patientId,
            'Medication Delivery Update',
            `Your order is now ${status.replace(
              '_',
              ' '
            )}.`
          );
        } catch (notificationError) {
          console.error(
            '[DISPATCH DASHBOARD] PATIENT NOTIFICATION ERROR:',
            notificationError
          );
        }
      } catch (error) {
        console.error(
          '[DISPATCH DASHBOARD] STATUS UPDATE ERROR:',
          error
        );
      }
    };

  /**
   * =========================================================
   * DERIVED COUNTS
   * =========================================================
   */
  const pendingDeliveries =
    deliveries.filter(
      (delivery) =>
        delivery.status === 'pending'
    );

  const assignedDeliveries =
    deliveries.filter(
      (delivery) =>
        delivery.dispatchId ===
          user.id &&
        delivery.status !==
          'delivered'
    );

  /**
   * =========================================================
   * RENDER
   * =========================================================
   */
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in duration-500">

      {/* =====================================================
          HEADER
      ===================================================== */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12 gap-6">

        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">
            {user.name}
          </h1>

          <div className="flex items-center space-x-4 mt-2">

            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full inline-block">
              Clinical Logistics Partner
            </p>

            <button
              onClick={
                toggleOnlineStatus
              }
              className={`px-4 py-1 rounded-full text-[9px] font-black uppercase tracking-widest transition-all border-2 ${
                isOnline
                  ? 'bg-emerald-600 border-emerald-600 text-white'
                  : 'bg-slate-100 border-slate-200 text-slate-400'
              }`}
            >
              {isOnline
                ? 'Online'
                : 'Offline'}
            </button>

          </div>
        </div>

        {/* GPS CARD */}
        <div className="p-6 bg-slate-900 rounded-[2.5rem] text-white shadow-xl flex items-center space-x-6 border border-white/10">

          <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center">

            <div
              className={`w-3 h-3 rounded-full ${
                isOnline
                  ? 'bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.8)]'
                  : 'bg-slate-600'
              }`}
            />

          </div>

          <div>
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">
              Live GPS Metadata
            </p>

            <p className="text-[11px] font-black tracking-widest">
              {isOnline
                ? myLocation
                  ? `${myLocation.lat.toFixed(
                      6
                    )} N, ${myLocation.lng.toFixed(
                      6
                    )} E`
                  : 'Searching Signals...'
                : 'Sensors Disabled'}
            </p>
          </div>

        </div>
      </div>

      {/* =====================================================
          DELIVERY SUMMARY
      ===================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">

        <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm">
          <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">
            Active Jobs
          </p>

          <p className="text-3xl font-black text-slate-900 mt-2">
            {deliveries.length}
          </p>
        </div>

        <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm">
          <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">
            Assigned To Me
          </p>

          <p className="text-3xl font-black text-emerald-600 mt-2">
            {assignedDeliveries.length}
          </p>
        </div>

        <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm">
          <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">
            Awaiting Dispatch
          </p>

          <p className="text-3xl font-black text-slate-900 mt-2">
            {pendingDeliveries.length}
          </p>
        </div>

      </div>

      {/* =====================================================
          MAIN GRID
      ===================================================== */}
      <div className="grid lg:grid-cols-12 gap-10">

        {/* ===================================================
            MAP
        =================================================== */}
        <div className="lg:col-span-8 bg-white rounded-[4rem] border border-slate-100 overflow-hidden relative shadow-2xl h-[650px] p-4">

          <div
            ref={mapContainerRef}
            className="w-full h-full z-10"
          />

          {/* MAP OVERLAY */}
          <div className="absolute top-8 left-8 z-20 flex flex-col space-y-3 pointer-events-none">

            <div className="bg-white/90 backdrop-blur-md px-4 py-2 rounded-xl shadow-lg border border-slate-100 pointer-events-auto">

              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
                Map Intelligence
              </p>

              <p className="text-[10px] font-bold text-slate-900">
                {deliveries.length}{' '}
                Patients in Vector
              </p>

            </div>

            {focusedDeliveryId && (
              <button
                onClick={() =>
                  setFocusedDeliveryId(
                    null
                  )
                }
                className="bg-slate-900 text-white px-4 py-2 rounded-xl shadow-lg text-[8px] font-black uppercase tracking-widest pointer-events-auto hover:bg-emerald-600 transition"
              >
                Reset Vector View
              </button>
            )}

          </div>

          {/* LOCATION OVERLAY */}
          {(!myLocation ||
            !isOnline) && (
            <div className="absolute inset-0 z-30 bg-slate-900/10 backdrop-blur-sm flex items-center justify-center rounded-[3.5rem] m-4 pointer-events-none">

              <div className="bg-white px-8 py-4 rounded-2xl shadow-xl flex items-center space-x-4">

                {isOnline ? (
                  <>
                    <div className="w-5 h-5 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />

                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-900">
                      Establishing Secure Uplink...
                    </span>
                  </>
                ) : (
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                    Logistics Link Offline
                  </span>
                )}

              </div>
            </div>
          )}
        </div>

        {/* ===================================================
            DELIVERIES
        =================================================== */}
        <div className="lg:col-span-4 space-y-8">

          <div className="flex justify-between items-center">

            <h2 className="text-xs font-black uppercase tracking-[0.3em] text-slate-400">
              Clinical Assignments
            </h2>

            <span className="px-3 py-1 bg-slate-100 text-slate-500 rounded-lg text-[9px] font-black uppercase tracking-widest">
              {deliveries.length}{' '}
              Active
            </span>

          </div>

          {/* ERROR */}
          {deliveryError && (
            <div className="p-5 bg-red-50 border border-red-100 rounded-3xl">

              <p className="text-[9px] font-black uppercase tracking-widest text-red-500">
                Delivery Feed Error
              </p>

              <p className="text-xs font-bold text-red-700 mt-2">
                {deliveryError}
              </p>

            </div>
          )}

          {/* LOADING */}
          {loadingDeliveries ? (
            <div className="text-center py-24 bg-slate-50 rounded-[4rem] border-4 border-dashed border-slate-100">

              <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-6" />

              <h3 className="text-lg font-black text-slate-900 tracking-tight">
                Loading Assignments
              </h3>

              <p className="text-slate-400 font-medium text-[10px] uppercase tracking-widest mt-1">
                Connecting to clinical logistics...
              </p>

            </div>
          ) : (
            <div className="space-y-6 max-h-[550px] overflow-y-auto custom-scrollbar pr-2">

              {deliveries.length > 0 ? (
                deliveries.map(
                  (delivery) => (
                    <div
                      key={
                        delivery.id
                      }
                      onClick={() =>
                        setFocusedDeliveryId(
                          delivery.id
                        )
                      }
                      className={`p-10 border rounded-[3.5rem] shadow-xl hover:shadow-2xl transition-all duration-300 animate-in slide-in-from-right-8 group cursor-pointer ${
                        focusedDeliveryId ===
                        delivery.id
                          ? 'bg-emerald-50 border-emerald-200'
                          : 'bg-white border-slate-100'
                      }`}
                    >

                      {/* HEADER */}
                      <div className="mb-8 flex items-center justify-between">

                        <div>

                          <div className="flex items-center gap-2 mb-2">

                            <p className="text-[9px] font-black uppercase text-emerald-600 tracking-widest">
                              Destination Hub
                            </p>

                            {delivery.status ===
                              'pending' && (
                              <span className="px-2 py-1 bg-amber-50 text-amber-600 rounded-md text-[7px] font-black uppercase">
                                Awaiting Assignment
                              </span>
                            )}

                          </div>

                          <h3 className="text-2xl font-black text-slate-900 leading-tight">
                            {
                              delivery.patientName
                            }
                          </h3>

                        </div>

                        <div
                          className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${
                            focusedDeliveryId ===
                            delivery.id
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-50 text-slate-300 group-hover:text-emerald-600'
                          }`}
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
                              strokeWidth="2.5"
                              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                            />

                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                            />
                          </svg>
                        </div>

                      </div>

                      {/* ADDRESS */}
                      <div
                        className={`p-6 rounded-2xl border mb-6 transition-all ${
                          focusedDeliveryId ===
                          delivery.id
                            ? 'bg-white border-emerald-100'
                            : 'bg-slate-50 border-slate-100'
                        }`}
                      >

                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
                          Clinical Address
                        </p>

                        <p className="text-xs text-slate-600 font-bold leading-relaxed">
                          {
                            delivery.patientAddress ||
                            'Patient address unavailable'
                          }
                        </p>

                      </div>

                      {/* MEDICATION */}
                      <div
                        className={`p-6 rounded-2xl border mb-8 transition-all ${
                          focusedDeliveryId ===
                          delivery.id
                            ? 'bg-emerald-100/30 border-emerald-200'
                            : 'bg-emerald-50/50 border-emerald-100'
                        }`}
                      >

                        <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest mb-2">
                          Medication Package
                        </p>

                        <div className="text-xs text-slate-700 font-bold">

                          <p className="mb-1">
                            {
                              delivery.medications
                            }
                          </p>

                          <p className="text-[9px] text-emerald-700 opacity-70 italic">
                            {
                              delivery.dosage
                            }
                          </p>

                        </div>
                      </div>

                      {/* STATUS / ACTION */}
                      <div className="space-y-4">

                        {/* PENDING */}
                        {delivery.status ===
                          'pending' && (
                          <div className="w-full bg-amber-50 border border-amber-100 text-amber-700 py-5 rounded-[1.75rem] font-black uppercase text-[9px] tracking-widest text-center">
                            Awaiting Pharmacy Assignment
                          </div>
                        )}

                        {/* ASSIGNED */}
                        {delivery.status ===
                          'assigned' && (
                          <button
                            disabled={
                              !isOnline
                            }
                            onClick={(
                              e
                            ) => {
                              e.stopPropagation();

                              updateDeliveryStatus(
                                delivery.id,
                                'in_transit'
                              );
                            }}
                            className="w-full bg-emerald-600 text-white py-5 rounded-[1.75rem] font-black uppercase text-[10px] tracking-widest hover:bg-emerald-700 transition shadow-xl shadow-emerald-100 active:scale-95 disabled:opacity-50"
                          >
                            Initialize Route
                          </button>
                        )}

                        {/* IN TRANSIT */}
                        {delivery.status ===
                          'in_transit' && (
                          <button
                            onClick={(
                              e
                            ) => {
                              e.stopPropagation();

                              updateDeliveryStatus(
                                delivery.id,
                                'delivered'
                              );
                            }}
                            className="w-full bg-slate-900 text-white py-5 rounded-[1.75rem] font-black uppercase text-[10px] tracking-widest hover:bg-emerald-600 transition shadow-xl shadow-slate-200 active:scale-95"
                          >
                            Confirm Drop-off
                          </button>
                        )}

                        {/* STATUS */}
                        <div className="flex items-center justify-center space-x-3 px-6 py-4 bg-white border-2 border-slate-100 rounded-2xl">

                          <div
                            className={`w-1.5 h-1.5 rounded-full ${
                              delivery.status ===
                              'in_transit'
                                ? 'bg-emerald-500 animate-pulse'
                                : delivery.status ===
                                  'assigned'
                                ? 'bg-emerald-500'
                                : 'bg-amber-400'
                            }`}
                          />

                          <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                            Status:{' '}
                            {delivery.status.replace(
                              '_',
                              ' '
                            )}
                          </span>

                        </div>

                      </div>
                    </div>
                  )
                )
              ) : (
                /* =================================================
                   EMPTY STATE
                ================================================== */
                <div className="text-center py-24 bg-slate-50 rounded-[4rem] border-4 border-dashed border-slate-100">

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
                        d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                      />
                    </svg>

                  </div>

                  <h3 className="text-lg font-black text-slate-900 tracking-tight">
                    Logistics Deck Clear
                  </h3>

                  <p className="text-slate-400 font-medium text-[10px] uppercase tracking-widest mt-1">
                    Awaiting clinical dispatch signals...
                  </p>

                </div>
              )}

            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DispatchDashboard;