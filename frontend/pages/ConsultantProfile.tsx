import React, { useEffect, useState } from 'react';
import { User } from '../types.ts';
import { ClinicalAPI } from '../services/apiService.ts';
import { Link } from 'react-router-dom';

interface ConsultantProfileProps {
  user: User;
}

const ConsultantProfile: React.FC<ConsultantProfileProps> = ({ user }) => {
  const [profile, setProfile] = useState<User>(user);

  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState('');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState('');

  const [blockedSlots, setBlockedSlots] = useState<Record<string, any>>({});
  const [loadingAvailability, setLoadingAvailability] = useState(true);
  const [savingAvailability, setSavingAvailability] = useState(false);
  const [availabilityMessage, setAvailabilityMessage] = useState('');

  /*
   * Load consultant availability
   */
  useEffect(() => {
    const loadAvailability = async () => {
      try {
        const data = await ClinicalAPI.getAvailability(user.id);

        setBlockedSlots(data?.blockedSlots || {});
      } catch (error) {
        console.error('Failed to load availability:', error);
      } finally {
        setLoadingAvailability(false);
      }
    };

    loadAvailability();
  }, [user.id]);

  /*
   * Change password
   */
  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();

    setPasswordMessage('');

    if (newPassword !== confirmPassword) {
      setPasswordMessage('New passwords do not match.');
      return;
    }

    if (newPassword.length < 8) {
      setPasswordMessage(
        'New password must be at least 8 characters.'
      );
      return;
    }

    setChangingPassword(true);

    try {
      await ClinicalAPI.changePassword(
        currentPassword,
        newPassword
      );

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');

      setPasswordMessage(
        'Password changed successfully.'
      );
    } catch (error) {
      console.error('Password change error:', error);

      setPasswordMessage(
        error instanceof Error
          ? error.message
          : 'Failed to change password.'
      );
    } finally {
      setChangingPassword(false);
    }
  };


  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setSavingProfile(true);
    setProfileMessage('');

    try {
      await ClinicalAPI.saveProfile(profile);

      setProfileMessage(
        'Professional profile updated successfully.'
      );
    } catch (error) {
      console.error('Profile update error:', error);

      setProfileMessage(
        error instanceof Error
          ? error.message
          : 'Failed to update profile.'
      );
    } finally {
      setSavingProfile(false);
    }
  };
  /*
   * Toggle availability for a day
   */
  const toggleDay = (day: string) => {
    setBlockedSlots(prev => {
      const updated = { ...prev };

      if (updated[day]) {
        delete updated[day];
      } else {
        updated[day] = {
          blocked: true
        };
      }

      return updated;
    });
  };

  /*
   * Save availability
   */
  const handleAvailabilitySubmit = async () => {
    setSavingAvailability(true);
    setAvailabilityMessage('');

    try {
      await ClinicalAPI.setAvailability(
        user.id,
        blockedSlots
      );

      setAvailabilityMessage(
        'Availability updated successfully.'
      );
    } catch (error) {
      console.error('Availability update error:', error);

      setAvailabilityMessage(
        error instanceof Error
          ? error.message
          : 'Failed to update availability.'
      );
    } finally {
      setSavingAvailability(false);
    }
  };

  const days = [
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
    'Sunday'
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

      {/* Header */}
      <div className="flex items-center justify-between mb-10">
        <div>
          <Link
            to="/dashboard"
            className="text-xs font-black uppercase tracking-widest text-emerald-600 hover:underline"
          >
            ← Back to Dashboard
          </Link>

          <h1 className="text-4xl font-black text-slate-900 tracking-tight mt-4">
            Profile & Settings
          </h1>

          <p className="text-sm text-slate-500 mt-2">
            Manage your professional profile, security and consultation availability.
          </p>
        </div>
      </div>

      {/* PROFESSIONAL PROFILE */}
      <section className="bg-white rounded-[3rem] p-8 md:p-10 border border-slate-100 shadow-xl mb-8">

        <div className="mb-8">
          <h2 className="text-xs font-black uppercase tracking-widest text-slate-400">
            Professional Profile
          </h2>

          <p className="text-sm text-slate-500 mt-2">
            Keep your professional information up to date for patients.
          </p>
        </div>

        <form onSubmit={handleProfileSubmit} className="space-y-6">

          {/* Name */}
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
              Full Name
            </label>

            <input
              value={profile.name || ''}
              onChange={e =>
                setProfile({
                  ...profile,
                  name: e.target.value
                })
              }
              className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:border-emerald-600"
              required
            />
          </div>

          {/* Email */}
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
              Email
            </label>

            <input
              value={profile.email || ''}
              disabled
              className="w-full px-6 py-4 bg-slate-100 border border-slate-100 rounded-2xl text-slate-500 cursor-not-allowed"
            />

            <p className="text-[10px] text-slate-400 mt-2">
              Email cannot be changed here.
            </p>
          </div>

          {/* Phone */}
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
              Phone Number
            </label>

            <input
              value={profile.phone || ''}
              onChange={e =>
                setProfile({
                  ...profile,
                  phone: e.target.value
                })
              }
              className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:border-emerald-600"
            />
          </div>

          {/* Specialty */}
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
              Medical Specialty
            </label>

            <select
              value={profile.specialty || ''}
              onChange={e =>
                setProfile({
                  ...profile,
                  specialty: e.target.value
                })
              }
              className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:border-emerald-600"
              required
            >
              <option value="">Select your specialty</option>
              <option value="General Medicine">
                General Medicine
              </option>
              <option value="Cardiology">
                Cardiology
              </option>
              <option value="Dermatology">
                Dermatology
              </option>
              <option value="Pediatrics">
                Pediatrics
              </option>
              <option value="Psychiatry">
                Psychiatry
              </option>
              <option value="Gynecology">
                Gynecology
              </option>
              <option value="Neurology">
                Neurology
              </option>
              <option value="Orthopedics">
                Orthopedics
              </option>
              <option value="Ophthalmology">
                Ophthalmology
              </option>
              <option value="Dentistry">
                Dentistry
              </option>
              <option value="Other">
                Other
              </option>
            </select>
          </div>

          {/* Address */}
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
              Address
            </label>

            <textarea
              value={profile.address || ''}
              onChange={e =>
                setProfile({
                  ...profile,
                  address: e.target.value
                })
              }
              className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:border-emerald-600 h-24"
            />
          </div>

          {profileMessage && (
            <div className="p-4 bg-emerald-50 text-emerald-700 rounded-2xl text-sm font-bold">
              {profileMessage}
            </div>
          )}

          <button
            type="submit"
            disabled={savingProfile}
            className="px-8 py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-emerald-200 disabled:opacity-50"
          >
            {savingProfile
              ? 'Saving...'
              : 'Save Profile'}
          </button>

        </form>
      </section>

      {/* CHANGE PASSWORD */}
      <section className="bg-white rounded-[3rem] p-8 md:p-10 border border-slate-100 shadow-xl mb-8">

        <div className="mb-8">
          <h2 className="text-xs font-black uppercase tracking-widest text-slate-400">
            Account Security
          </h2>

          <p className="text-sm text-slate-500 mt-2">
            Change your consultant account password.
          </p>
        </div>




        <form onSubmit={handlePasswordChange} className="space-y-6">

          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
              Current Password
            </label>

            <input
              type="password"
              value={currentPassword}
              onChange={e =>
                setCurrentPassword(e.target.value)
              }
              className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:border-emerald-600"
              required
            />
          </div>

          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
              New Password
            </label>

            <input
              type="password"
              value={newPassword}
              onChange={e =>
                setNewPassword(e.target.value)
              }
              className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:border-emerald-600"
              required
            />
          </div>

          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
              Confirm New Password
            </label>

            <input
              type="password"
              value={confirmPassword}
              onChange={e =>
                setConfirmPassword(e.target.value)
              }
              className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:border-emerald-600"
              required
            />
          </div>

          {passwordMessage && (
            <div className="p-4 bg-slate-50 rounded-2xl text-sm font-bold">
              {passwordMessage}
            </div>
          )}

          <button
            type="submit"
            disabled={changingPassword}
            className="px-8 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest disabled:opacity-50"
          >
            {changingPassword
              ? 'Changing Password...'
              : 'Change Password'}
          </button>

        </form>
      </section>

      {/* AVAILABILITY */}
      <section className="bg-white rounded-[3rem] p-8 md:p-10 border border-slate-100 shadow-xl">

        <div className="mb-8">
          <h2 className="text-xs font-black uppercase tracking-widest text-slate-400">
            Consultation Availability
          </h2>

          <p className="text-sm text-slate-500 mt-2">
            Select the days when patients should be able to book appointments with you.
          </p>
        </div>

        {loadingAvailability ? (
          <div className="py-10 text-center text-slate-400">
            Loading availability...
          </div>
        ) : (
          <div className="space-y-3">

            {days.map(day => {
              const isBlocked = !!blockedSlots[day];

              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleDay(day)}
                  className={`w-full flex items-center justify-between p-5 rounded-2xl border transition ${isBlocked
                      ? 'bg-slate-50 border-slate-100'
                      : 'bg-emerald-50 border-emerald-100'
                    }`}
                >
                  <span className="font-bold text-slate-900">
                    {day}
                  </span>

                  <span
                    className={`text-[9px] font-black uppercase tracking-widest ${isBlocked
                        ? 'text-slate-400'
                        : 'text-emerald-600'
                      }`}
                  >
                    {isBlocked
                      ? 'Unavailable'
                      : 'Available'}
                  </span>
                </button>
              );
            })}

          </div>
        )}

        {availabilityMessage && (
          <div className="mt-6 p-4 bg-emerald-50 text-emerald-700 rounded-2xl text-sm font-bold">
            {availabilityMessage}
          </div>
        )}

        <button
          type="button"
          onClick={handleAvailabilitySubmit}
          disabled={savingAvailability || loadingAvailability}
          className="mt-6 px-8 py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-emerald-200 disabled:opacity-50"
        >
          {savingAvailability
            ? 'Saving...'
            : 'Save Availability'}
        </button>

      </section>

    </div>
  );
};

export default ConsultantProfile;