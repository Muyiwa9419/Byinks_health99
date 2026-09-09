import React, {
  useState,
  useEffect,
  useRef,
} from 'react';

import {
  User,
  DeliveryOrder,
} from '../types.ts';

import { ClinicalAPI } from '../services/apiService.ts';

// Leaflet is loaded globally through CDN
declare const L: any;

/**
 * DeliveryOrder in the backend now includes patientPhone.
 *
 * Keeping it optional here also allows older delivery records
 * to continue rendering without breaking TypeScript.
 */
type DispatchDelivery = DeliveryOrder & {
  patientPhone?: string | null;
};

const DispatchDashboard: React.FC<{
  user: User;
}> = ({ user }) => {
  const [deliveries, setDeliveries] =
    useState<DispatchDelivery[]>([]);

  const [myLocation, setMyLocation] =
    useState<{
      lat: number;
      lng: number;
    } | null>(null);

  const [isOnline, setIsOnline] =
    useState(
      user.isOnline ?? true
    );

  const [
    focusedDeliveryId,
    setFocusedDeliveryId,
  ] = useState<string | null>(null);

  const [
    loadingDeliveries,
    setLoadingDeliveries,
  ] = useState(true);

  const [
    deliveryError,
    setDeliveryError,
  ] = useState<string | null>(null);

  const mapRef =
    useRef<any>(null);

  const dispatcherMarkerRef =
    useRef<any>(null);

  const deliveryMarkersRef =
    useRef<Map<string, any>>(
      new Map()
    );

  const routeLinesRef =
    useRef<Map<string, any>>(
      new Map()
    );

  const mapContainerRef =
    useRef<HTMLDivElement>(null);

  /**
   * =========================================================
   * HELPERS
   * =========================================================
   */

  const escapeHtml = (
    value: unknown
  ) => {
    return String(value ?? '')
      .replace(
        /&/g,
        '&amp;'
      )
      .replace(
        /</g,
        '&lt;'
      )
      .replace(
        />/g,
        '&gt;'
      )
      .replace(
        /"/g,
        '&quot;'
      )
      .replace(
        /'/g,
        '&#039;'
      );
  };

  const getDestination = (
    delivery: DispatchDelivery
  ) => {
    if (
      delivery.patientLocation &&
      typeof delivery.patientLocation.lat ===
        'number' &&
      typeof delivery.patientLocation.lng ===
        'number'
    ) {
      return {
        lat:
          delivery.patientLocation.lat,
        lng:
          delivery.patientLocation.lng,
        hasCoordinates: true,
      };
    }

    return {
      lat: null,
      lng: null,
      hasCoordinates: false,
    };
  };

  const getDirectionsUrl = (
    delivery: DispatchDelivery
  ) => {
    const destination =
      getDestination(delivery);

    if (
      destination.hasCoordinates &&
      destination.lat !== null &&
      destination.lng !== null
    ) {
      return `https://www.google.com/maps/dir/?api=1&destination=${destination.lat},${destination.lng}`;
    }

    if (
      delivery.patientAddress
    ) {
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        delivery.patientAddress
      )}`;
    }

    return null;
  };

  /**
   * =========================================================
   * LOAD DELIVERIES
   * =========================================================
   */
  useEffect(() => {
    let mounted = true;

    const fetchData =
      async () => {
        try {
          console.log(
            '================================================'
          );

          console.log(
            '[DISPATCH DASHBOARD] FETCHING DELIVERIES'
          );

          console.log(
            '[DISPATCH DASHBOARD] Dispatcher:',
            user.id
          );

          setDeliveryError(null);

          const backendDeliveries =
            await ClinicalAPI.getDeliveries();

          console.log(
            '[DISPATCH DASHBOARD] BACKEND RESPONSE:',
            backendDeliveries
          );

          if (
            !Array.isArray(
              backendDeliveries
            )
          ) {
            throw new Error(
              'Invalid delivery response from server'
            );
          }

          /**
           * Backend already filters dispatcher jobs.
           *
           * We still perform a frontend safety filter.
           */
          const activeDeliveries =
            backendDeliveries.filter(
              (
                delivery: DispatchDelivery
              ) => {
                if (!delivery) {
                  return false;
                }

                /**
                 * Never show completed deliveries.
                 */
                if (
                  delivery.status ===
                    'delivered' ||
                  delivery.status ===
                    'completed'
                ) {
                  return false;
                }

                /**
                 * Pending jobs are available
                 * in the dispatch queue.
                 */
                if (
                  delivery.status ===
                  'pending'
                ) {
                  return true;
                }

                /**
                 * Assigned and in-transit jobs
                 * must belong to this dispatcher.
                 */
                return (
                  delivery.dispatchId ===
                  user.id
                );
              }
            );

          console.log(
            '[DISPATCH DASHBOARD] ACTIVE DELIVERIES:',
            activeDeliveries
          );

          activeDeliveries.forEach(
            (
              delivery: DispatchDelivery
            ) => {
              console.log(
                '[DISPATCH DASHBOARD] DELIVERY DETAILS:',
                {
                  id:
                    delivery.id,

                  patientId:
                    delivery.patientId,

                  patientName:
                    delivery.patientName,

                  patientPhone:
                    delivery.patientPhone,

                  patientAddress:
                    delivery.patientAddress,

                  patientLocation:
                    delivery.patientLocation,

                  status:
                    delivery.status,

                  dispatchId:
                    delivery.dispatchId,
                }
              );
            }
          );

          if (mounted) {
            setDeliveries(
              activeDeliveries
            );
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
            setLoadingDeliveries(
              false
            );
          }
        }
      };

    fetchData();

    /**
     * Refresh every 5 seconds.
     */
    const refreshTimer =
      window.setInterval(
        fetchData,
        5000
      );

    const handleStorage =
      () => {
        fetchData();
      };

    window.addEventListener(
      'storage',
      handleStorage
    );

    return () => {
      mounted = false;

      window.clearInterval(
        refreshTimer
      );

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

    const trackLocation =
      () => {
        if (!isOnline) {
          return;
        }

        if (
          !navigator.geolocation
        ) {
          console.error(
            '[DISPATCH DASHBOARD] Geolocation unavailable'
          );

          return;
        }

        navigator.geolocation.getCurrentPosition(
          async (
            position
          ) => {
            if (!mounted) {
              return;
            }

            const location = {
              lat:
                position.coords
                  .latitude,

              lng:
                position.coords
                  .longitude,
            };

            console.log(
              '[DISPATCH DASHBOARD] CURRENT LOCATION:',
              location
            );

            setMyLocation(
              location
            );

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

    trackLocation();

    const geoTimer =
      window.setInterval(
        trackLocation,
        5000
      );

    return () => {
      mounted = false;

      window.clearInterval(
        geoTimer
      );
    };
  }, [
    user.id,
    isOnline,
  ]);

  /**
   * =========================================================
   * MAP INITIALIZATION
   * =========================================================
   */
  useEffect(() => {
    if (
      !mapContainerRef.current
    ) {
      return;
    }

    if (mapRef.current) {
      return;
    }

    if (
      typeof L === 'undefined'
    ) {
      console.error(
        '[DISPATCH DASHBOARD] Leaflet not loaded'
      );

      return;
    }

    const initialView =
      myLocation
        ? [
            myLocation.lat,
            myLocation.lng,
          ]
        : [6.4674, 3.4070];

    mapRef.current =
      L.map(
        mapContainerRef.current,
        {
          zoomControl: false,
          attributionControl:
            false,
        }
      ).setView(
        initialView,
        14
      );

    L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
      {
        maxZoom: 19,
      }
    ).addTo(
      mapRef.current
    );

    L.control
      .zoom({
        position:
          'bottomright',
      })
      .addTo(
        mapRef.current
      );

    setTimeout(() => {
      if (
        mapRef.current
      ) {
        mapRef.current.invalidateSize();
      }
    }, 300);

    return () => {
      if (
        mapRef.current
      ) {
        mapRef.current.remove();

        mapRef.current =
          null;
      }

      dispatcherMarkerRef.current =
        null;

      deliveryMarkersRef.current.clear();

      routeLinesRef.current.clear();
    };
  }, []);

  /**
   * =========================================================
   * DISPATCHER MARKER
   * =========================================================
   */
  useEffect(() => {
    if (
      !mapRef.current
    ) {
      return;
    }

    if (!isOnline) {
      if (
        dispatcherMarkerRef.current
      ) {
        dispatcherMarkerRef.current.remove();

        dispatcherMarkerRef.current =
          null;
      }

      return;
    }

    if (!myLocation) {
      return;
    }

    if (
      !dispatcherMarkerRef.current
    ) {
      const icon =
        L.divIcon({
          className:
            'custom-div-icon',

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

          iconSize: [
            40,
            40,
          ],

          iconAnchor: [
            20,
            20,
          ],
        });

      dispatcherMarkerRef.current =
        L.marker(
          [
            myLocation.lat,
            myLocation.lng,
          ],
          {
            icon,
          }
        )
          .addTo(
            mapRef.current
          )
          .bindPopup(
            `
              <div style="padding:8px;text-align:center;font-family:Arial,sans-serif;">
                <strong>YOUR LOCATION</strong>
                <br/>
                Dispatcher
              </div>
            `
          );
    } else {
      dispatcherMarkerRef.current.setLatLng(
        [
          myLocation.lat,
          myLocation.lng,
        ]
      );
    }
  }, [
    myLocation,
    isOnline,
  ]);

  /**
   * =========================================================
   * DELIVERY MARKERS + ROUTES
   * =========================================================
   */
  useEffect(() => {
    if (
      !mapRef.current
    ) {
      return;
    }

    if (!myLocation) {
      return;
    }

    const activeDeliveryIds =
      new Set(
        deliveries.map(
          (delivery) =>
            delivery.id
        )
      );

    /**
     * Remove stale markers.
     */
    deliveryMarkersRef.current.forEach(
      (
        marker,
        id
      ) => {
        if (
          !activeDeliveryIds.has(
            id
          )
        ) {
          marker.remove();

          deliveryMarkersRef.current.delete(
            id
          );
        }
      }
    );

    /**
     * Remove stale routes.
     */
    routeLinesRef.current.forEach(
      (
        line,
        id
      ) => {
        if (
          !activeDeliveryIds.has(
            id
          )
        ) {
          line.remove();

          routeLinesRef.current.delete(
            id
          );
        }
      }
    );

    deliveries.forEach(
      (
        delivery
      ) => {
        const destination =
          getDestination(
            delivery
          );

        /**
         * If the patient doesn't have coordinates,
         * don't create a fake map destination.
         */
        if (
          !destination.hasCoordinates
        ) {
          return;
        }

        const destinationPoint: [
          number,
          number
        ] = [
          destination.lat as number,
          destination.lng as number,
        ];

        /**
         * ---------------------------------------------------
         * PATIENT MARKER
         * ---------------------------------------------------
         */

        if (
          !deliveryMarkersRef.current.has(
            delivery.id
          )
        ) {
          const icon =
            L.divIcon({
              className:
                'custom-div-icon',

              html: `
                <div class="w-9 h-9 bg-slate-900 rounded-xl flex items-center justify-center text-white shadow-xl border-2 border-white">

                  <svg
                    class="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2.5"
                      d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                    />

                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>

                </div>
              `,

              iconSize: [
                36,
                36,
              ],

              iconAnchor: [
                18,
                18,
              ],
            });

          const popupName =
            escapeHtml(
              delivery.patientName ||
                'Patient'
            );

          const popupAddress =
            escapeHtml(
              delivery.patientAddress ||
                'Address unavailable'
            );

          const popupPhone =
            escapeHtml(
              delivery.patientPhone ||
                'Phone unavailable'
            );

          const popupStatus =
            escapeHtml(
              String(
                delivery.status
              ).replace(
                '_',
                ' '
              )
            );

          const marker =
            L.marker(
              destinationPoint,
              {
                icon,
              }
            )
              .addTo(
                mapRef.current
              )
              .bindPopup(
                `
                  <div style="min-width:240px;padding:8px;font-family:Arial,sans-serif;">

                    <div style="font-weight:900;font-size:14px;margin-bottom:10px;">
                      ${popupName}
                    </div>

                    <div style="font-size:12px;margin-bottom:7px;">
                      <strong>Phone:</strong>
                      ${popupPhone}
                    </div>

                    <div style="font-size:12px;line-height:1.45;margin-bottom:8px;">
                      <strong>Address:</strong>
                      ${popupAddress}
                    </div>

                    <div style="font-size:10px;color:#64748b;text-transform:uppercase;font-weight:700;">
                      Status:
                      ${popupStatus}
                    </div>

                  </div>
                `
              );

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
            marker.setLatLng(
              destinationPoint
            );
          }
        }

        /**
         * ---------------------------------------------------
         * ROUTE LINE
         * ---------------------------------------------------
         */

        const routePoints = [
          [
            myLocation.lat,
            myLocation.lng,
          ],

          destinationPoint,
        ];

        const isFocused =
          delivery.id ===
          focusedDeliveryId;

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
                  isFocused
                    ? '#10b981'
                    : '#cbd5e1',

                weight:
                  isFocused
                    ? 6
                    : 3,

                opacity:
                  isFocused
                    ? 0.8
                    : 0.4,

                dashArray:
                  delivery.status ===
                  'assigned'
                    ? '10, 10'
                    : undefined,
              }
            ).addTo(
              mapRef.current
            );

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
            line.setLatLngs(
              routePoints
            );

            line.setStyle({
              color:
                isFocused
                  ? '#10b981'
                  : '#cbd5e1',

              weight:
                isFocused
                  ? 6
                  : 3,

              opacity:
                isFocused
                  ? 0.8
                  : 0.4,

              dashArray:
                delivery.status ===
                'assigned'
                  ? '10, 10'
                  : undefined,
            });
          }
        }
      }
    );

    /**
     * -------------------------------------------------------
     * FOCUS SELECTED DELIVERY
     * -------------------------------------------------------
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
            padding: [
              100,
              100,
            ],
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

      let hasPatientCoordinates =
        false;

      deliveries.forEach(
        (
          delivery
        ) => {
          const destination =
            getDestination(
              delivery
            );

          if (
            destination.hasCoordinates
          ) {
            hasPatientCoordinates =
              true;

            bounds.extend([
              destination.lat as number,
              destination.lng as number,
            ]);
          }
        }
      );

      if (
        hasPatientCoordinates
      ) {
        mapRef.current.fitBounds(
          bounds,
          {
            padding: [
              50,
              50,
            ],
          }
        );
      }
    }
  }, [
    deliveries,
    myLocation,
    isOnline,
    focusedDeliveryId,
  ]);

  /**
   * =========================================================
   * ONLINE / OFFLINE
   * =========================================================
   */
  const toggleOnlineStatus =
    async () => {
      const newStatus =
        !isOnline;

      try {
        setIsOnline(
          newStatus
        );

        await ClinicalAPI.updateUserStatus(
          user.id,
          {
            isOnline:
              newStatus,
          }
        );

        try {
          const existingSession =
            JSON.parse(
              localStorage.getItem(
                'medi_local_session'
              ) || 'null'
            );

          if (
            existingSession &&
            existingSession.id ===
              user.id
          ) {
            localStorage.setItem(
              'medi_local_session',
              JSON.stringify({
                ...existingSession,

                isOnline:
                  newStatus,
              })
            );
          }
        } catch (error) {
          console.error(
            '[DISPATCH DASHBOARD] SESSION UPDATE ERROR:',
            error
          );
        }
      } catch (error) {
        console.error(
          '[DISPATCH DASHBOARD] ONLINE STATUS ERROR:',
          error
        );

        setIsOnline(
          !newStatus
        );
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

        if (
          status ===
            'delivered' ||
          status ===
            'completed'
        ) {
          setDeliveries(
            (current) =>
              current.filter(
                (
                  delivery
                ) =>
                  delivery.id !==
                  id
              )
          );

          setFocusedDeliveryId(
            null
          );
        } else {
          setDeliveries(
            (current) =>
              current.map(
                (
                  delivery
                ) =>
                  delivery.id ===
                  id
                    ? updatedDelivery
                    : delivery
              )
          );
        }

        if (
          status ===
          'in_transit'
        ) {
          setFocusedDeliveryId(
            id
          );
        }

        /**
         * Notify patient.
         */
        try {
          if (
            updatedDelivery?.patientId
          ) {
            await ClinicalAPI.addNotification(
              updatedDelivery.patientId,

              'Medication Delivery Update',

              `Your order is now ${String(
                status
              ).replace(
                '_',
                ' '
              )}.`
            );
          }
        } catch (
          notificationError
        ) {
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
   * COUNTS
   * =========================================================
   */

  const pendingDeliveries =
    deliveries.filter(
      (
        delivery
      ) =>
        delivery.status ===
        'pending'
    );

  const assignedDeliveries =
    deliveries.filter(
      (
        delivery
      ) =>
        delivery.dispatchId ===
          user.id &&
        delivery.status !==
          'delivered' &&
        delivery.status !==
          'completed'
    );

  /**
   * =========================================================
   * RENDER
   * =========================================================
   */

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 animate-in fade-in duration-500">

      {/* =====================================================
          HEADER
      ===================================================== */}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 sm:mb-12 gap-6">

        <div>
          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
            {user.name}
          </h1>

          <div className="flex flex-wrap items-center gap-3 mt-3">

            <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full">
              Clinical Logistics Partner
            </p>

            <button
              onClick={
                toggleOnlineStatus
              }
              className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest transition-all border-2 ${
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

        <div className="w-full md:w-auto p-5 sm:p-6 bg-slate-900 rounded-[2rem] text-white shadow-xl flex items-center space-x-5 border border-white/10">

          <div className="w-11 h-11 bg-white/10 rounded-2xl flex items-center justify-center shrink-0">

            <div
              className={`w-3 h-3 rounded-full ${
                isOnline
                  ? 'bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.8)]'
                  : 'bg-slate-600'
              }`}
            />

          </div>

          <div>
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">
              Live GPS Metadata
            </p>

            <p className="text-[10px] sm:text-[11px] font-black tracking-widest">
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
          SUMMARY
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

      <div className="grid lg:grid-cols-12 gap-8 lg:gap-10">

        {/* ===================================================
            MAP
        =================================================== */}

        <div className="lg:col-span-8 bg-white rounded-[2.5rem] sm:rounded-[4rem] border border-slate-100 overflow-hidden relative shadow-2xl h-[450px] sm:h-[650px] p-3 sm:p-4">

          <div
            ref={
              mapContainerRef
            }
            className="w-full h-full z-10 rounded-[2rem] sm:rounded-[3rem]"
          />

          <div className="absolute top-6 left-6 sm:top-8 sm:left-8 z-20 flex flex-col space-y-3 pointer-events-none">

            <div className="bg-white/95 backdrop-blur-md px-4 py-3 rounded-xl shadow-lg border border-slate-100">

              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
                Map Intelligence
              </p>

              <p className="text-[10px] font-bold text-slate-900">
                {deliveries.length}{' '}
                Active Patients
              </p>

            </div>

            {focusedDeliveryId && (
              <button
                onClick={() =>
                  setFocusedDeliveryId(
                    null
                  )
                }
                className="bg-slate-900 text-white px-4 py-3 rounded-xl shadow-lg text-[8px] font-black uppercase tracking-widest pointer-events-auto hover:bg-emerald-600 transition"
              >
                Reset Vector View
              </button>
            )}

          </div>

          {(!myLocation ||
            !isOnline) && (
            <div className="absolute inset-0 z-30 bg-slate-900/10 backdrop-blur-sm flex items-center justify-center rounded-[2.25rem] sm:rounded-[3.5rem] m-3 sm:m-4 pointer-events-none">

              <div className="bg-white px-6 sm:px-8 py-4 rounded-2xl shadow-xl flex items-center space-x-4">

                {isOnline ? (
                  <>
                    <div className="w-5 h-5 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />

                    <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-slate-900">
                      Establishing Secure Uplink...
                    </span>
                  </>
                ) : (
                  <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-slate-500">
                    Logistics Link Offline
                  </span>
                )}

              </div>
            </div>
          )}

        </div>

        {/* ===================================================
            DELIVERY LIST
        =================================================== */}

        <div className="lg:col-span-4 space-y-6 sm:space-y-8">

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

              <p className="text-xs font-bold text-red-700 mt-2 break-words">
                {deliveryError}
              </p>

            </div>
          )}

          {/* LOADING */}

          {loadingDeliveries ? (
            <div className="text-center py-24 bg-slate-50 rounded-[3rem] border-4 border-dashed border-slate-100">

              <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-6" />

              <h3 className="text-lg font-black text-slate-900 tracking-tight">
                Loading Assignments
              </h3>

              <p className="text-slate-400 font-medium text-[10px] uppercase tracking-widest mt-1">
                Connecting to clinical logistics...
              </p>

            </div>
          ) : (
            <div className="space-y-6 max-h-[650px] overflow-y-auto custom-scrollbar pr-1 sm:pr-2">

              {deliveries.length >
              0 ? (
                deliveries.map(
                  (
                    delivery
                  ) => {
                    const directionsUrl =
                      getDirectionsUrl(
                        delivery
                      );

                    return (
                      <div
                        key={
                          delivery.id
                        }
                        onClick={() =>
                          setFocusedDeliveryId(
                            delivery.id
                          )
                        }
                        className={`p-6 sm:p-8 border rounded-[2.5rem] sm:rounded-[3.5rem] shadow-xl hover:shadow-2xl transition-all duration-300 group cursor-pointer ${
                          focusedDeliveryId ===
                          delivery.id
                            ? 'bg-emerald-50 border-emerald-200'
                            : 'bg-white border-slate-100'
                        }`}
                      >

                        {/* =================================
                            PATIENT HEADER
                        ================================= */}

                        <div className="flex items-start justify-between gap-4 mb-6">

                          <div className="min-w-0">

                            <div className="flex flex-wrap items-center gap-2 mb-2">

                              <p className="text-[9px] font-black uppercase text-emerald-600 tracking-widest">
                                Patient
                              </p>

                              {delivery.status ===
                                'pending' && (
                                <span className="px-2 py-1 bg-amber-50 text-amber-600 rounded-md text-[7px] font-black uppercase">
                                  Awaiting Assignment
                                </span>
                              )}

                              {delivery.status ===
                                'assigned' && (
                                <span className="px-2 py-1 bg-emerald-50 text-emerald-600 rounded-md text-[7px] font-black uppercase">
                                  Assigned To You
                                </span>
                              )}

                              {delivery.status ===
                                'in_transit' && (
                                <span className="px-2 py-1 bg-blue-50 text-blue-600 rounded-md text-[7px] font-black uppercase">
                                  In Transit
                                </span>
                              )}

                            </div>

                            <h3 className="text-2xl font-black text-slate-900 leading-tight break-words">
                              {delivery.patientName ||
                                'Patient'}
                            </h3>

                          </div>

                          <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-slate-50 text-emerald-600 shrink-0">

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
                                d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v4a1 1 0 001 1h2a1 1 0 001-1v-4a1 1 0 001-1m-6 0h6"
                              />
                            </svg>

                          </div>

                        </div>

                        {/* =================================
                            PATIENT CONTACT
                        ================================= */}

                        <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 mb-5">

                          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-3">
                            Patient Contact
                          </p>

                          {delivery.patientPhone ? (
                            <a
                              href={`tel:${delivery.patientPhone}`}
                              onClick={(
                                e
                              ) =>
                                e.stopPropagation()
                              }
                              className="flex items-center gap-3 text-sm font-black text-emerald-600 hover:text-emerald-700"
                            >

                              <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center shadow-sm shrink-0">

                                <svg
                                  className="w-4 h-4"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth="2"
                                    d="M3 5a2 2 0 012-2h3.28a2 2 0 011.94 1.515l.72 2.88a2 2 0 01-.57 1.88L9.17 10.88a16 16 0 006.95 6.95l1.605-1.605a2 2 0 011.88-.57l2.88.72A2 2 0 0124 18.28V21a2 2 0 01-2 2C10.85 23 1 13.15 1 2a2 2 0 012-2z"
                                  />
                                </svg>

                              </div>

                              <div className="min-w-0">

                                <p className="text-[8px] text-slate-400 uppercase tracking-widest font-black mb-0.5">
                                  Phone
                                </p>

                                <span className="break-all">
                                  {delivery.patientPhone}
                                </span>

                              </div>

                            </a>
                          ) : (
                            <div className="flex items-center gap-3">

                              <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center shadow-sm text-slate-300">

                                <svg
                                  className="w-4 h-4"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth="2"
                                    d="M18.364 18.364A9 9 0 105.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                                  />
                                </svg>

                              </div>

                              <p className="text-xs font-bold text-slate-400">
                                Patient phone number unavailable
                              </p>

                            </div>
                          )}

                        </div>

                        {/* =================================
                            ADDRESS
                        ================================= */}

                        <div
                          className={`p-5 rounded-2xl border mb-5 ${
                            focusedDeliveryId ===
                            delivery.id
                              ? 'bg-white border-emerald-100'
                              : 'bg-slate-50 border-slate-100'
                          }`}
                        >

                          <div className="flex items-start gap-3">

                            <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center shadow-sm text-emerald-600 shrink-0">

                              <svg
                                className="w-4 h-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth="2"
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

                            <div className="min-w-0 flex-1">

                              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">
                                Delivery Address
                              </p>

                              <p className="text-xs text-slate-700 font-bold leading-relaxed break-words">
                                {delivery.patientAddress ||
                                  'Patient address unavailable'}
                              </p>

                            </div>

                          </div>

                        </div>

                        {/* =================================
                            DIRECTIONS
                        ================================= */}

                        {directionsUrl && (
                          <a
                            href={
                              directionsUrl
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(
                              e
                            ) =>
                              e.stopPropagation()
                            }
                            className="w-full flex items-center justify-center gap-3 bg-white border-2 border-slate-100 text-slate-700 py-4 rounded-2xl font-black uppercase text-[9px] tracking-widest hover:border-emerald-200 hover:text-emerald-600 transition mb-5"
                          >

                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M9 20l-5-2V6l5 2m0 12l6-2m-6 2V8m6 10l5 2V4l-5-2m0 16V6"
                              />
                            </svg>

                            Open Navigation

                          </a>
                        )}

                        {/* =================================
                            MEDICATION
                        ================================= */}

                        <div
                          className={`p-5 rounded-2xl border mb-6 ${
                            focusedDeliveryId ===
                            delivery.id
                              ? 'bg-emerald-100/30 border-emerald-200'
                              : 'bg-emerald-50/50 border-emerald-100'
                          }`}
                        >

                          <p className="text-[8px] font-black text-emerald-600 uppercase tracking-widest mb-2">
                            Medication Package
                          </p>

                          <p className="text-xs text-slate-700 font-bold leading-relaxed">
                            {delivery.medications ||
                              'Medication details unavailable'}
                          </p>

                          {delivery.dosage && (
                            <p className="text-[9px] text-emerald-700 opacity-70 italic mt-2">
                              {delivery.dosage}
                            </p>
                          )}

                        </div>

                        {/* =================================
                            ACTIONS
                        ================================= */}

                        <div className="space-y-4">

                          {delivery.status ===
                            'pending' && (
                            <div className="w-full bg-amber-50 border border-amber-100 text-amber-700 py-5 rounded-[1.5rem] font-black uppercase text-[9px] tracking-widest text-center">

                              Awaiting Pharmacy Assignment

                            </div>
                          )}

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
                              className="w-full bg-emerald-600 text-white py-5 rounded-[1.5rem] font-black uppercase text-[10px] tracking-widest hover:bg-emerald-700 transition shadow-xl shadow-emerald-100 active:scale-95 disabled:opacity-50"
                            >
                              Initialize Route
                            </button>
                          )}

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
                              className="w-full bg-slate-900 text-white py-5 rounded-[1.5rem] font-black uppercase text-[10px] tracking-widest hover:bg-emerald-600 transition shadow-xl shadow-slate-200 active:scale-95"
                            >
                              Confirm Drop-off
                            </button>
                          )}

                          <div className="flex items-center justify-center space-x-3 px-5 py-4 bg-white border-2 border-slate-100 rounded-2xl">

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
                              {String(
                                delivery.status
                              ).replace(
                                '_',
                                ' '
                              )}
                            </span>

                          </div>

                        </div>

                      </div>
                    );
                  }
                )
              ) : (
                <div className="text-center py-20 bg-slate-50 rounded-[3rem] border-4 border-dashed border-slate-100">

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

                  <p className="text-slate-400 font-medium text-[10px] uppercase tracking-widest mt-1 px-6">
                    No active medication deliveries are currently available.
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