import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiPhone, FiPhoneOff, FiMic, FiMicOff, FiVideo, FiVideoOff } from 'react-icons/fi';
import { useTranslation } from 'react-i18next';
import { useCall } from '../../context/CallContext';

const Avatar = ({ name, photo, size = 'lg' }) => {
  const { t } = useTranslation();
  const dim = size === 'lg' ? 'w-28 h-28 text-3xl' : 'w-20 h-20 text-2xl';
  if (photo) {
    return <img src={photo} alt={name || t('calls.caller')} className={`${dim} rounded-full object-cover shadow-xl`} />;
  }
  const initials = (name || 'U').split(' ').map((s) => s[0]).slice(0, 2).join('').toUpperCase();
  return (
    <div className={`${dim} rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white font-bold shadow-xl`}>
      {initials}
    </div>
  );
};

const RoundButton = ({ onClick, danger, active, label, children }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={label}
    className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors duration-[160ms] shadow-lg ${
      danger
        ? 'bg-destructive hover:bg-destructive/90 text-white'
        : active
          ? 'bg-white/30 text-white'
          : 'bg-white/15 hover:bg-white/25 text-white'
    }`}
  >
    {children}
  </button>
);

const CallOverlay = () => {
  const { t } = useTranslation();
  const {
    status, peer, type, muted, camOff, remoteJoined,
    acceptIncoming, declineIncoming, hangUp, toggleMute, toggleCam,
  } = useCall();

  if (status === 'idle') return null;

  const isVideo = type === 'video';
  const statusLabel =
    status === 'calling' ? t('calls.calling')
    : status === 'ringing' ? (isVideo ? t('calls.incomingVideoCall') : t('calls.incomingCall'))
    : remoteJoined ? t('calls.connected') : t('calls.connecting');

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] bg-surface-dark-1/95 backdrop-blur-md flex flex-col items-center justify-between py-12"
        role="dialog"
        aria-modal="true"
        aria-label={t('calls.dialogLabel')}
      >
        {/* Remote video fills the screen during an active video call */}
        {isVideo && status === 'active' && (
          <div id="remote-video" className="absolute inset-0 bg-black" />
        )}

        {/* Local video PiP */}
        {isVideo && status === 'active' && (
          <div
            id="local-video"
            className="absolute bottom-28 right-4 w-28 h-40 rounded-2xl overflow-hidden border-2 border-white/30 bg-black z-10"
          />
        )}

        {/* Peer identity (hidden once remote video is showing) */}
        {!(isVideo && remoteJoined && status === 'active') && (
          <div className="flex-1 flex flex-col items-center justify-center gap-5 z-10">
            <Avatar name={peer?.name} photo={peer?.photo} />
            <div className="text-center">
              <h2 className="text-2xl font-semibold text-white">{peer?.name || t('calls.unknown')}</h2>
              <p className="text-white/60 mt-1">{statusLabel}</p>
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="z-20 flex items-center gap-5">
          {status === 'ringing' ? (
            <>
              <RoundButton onClick={declineIncoming} danger label={t('calls.decline')}>
                <FiPhoneOff className="w-6 h-6" />
              </RoundButton>
              <RoundButton onClick={acceptIncoming} label={t('calls.accept')}>
                <FiPhone className="w-6 h-6 text-success" />
              </RoundButton>
            </>
          ) : (
            <>
              <RoundButton onClick={toggleMute} active={muted} label={muted ? t('calls.unmute') : t('calls.mute')}>
                {muted ? <FiMicOff className="w-6 h-6" /> : <FiMic className="w-6 h-6" />}
              </RoundButton>
              {isVideo && (
                <RoundButton onClick={toggleCam} active={camOff} label={camOff ? t('calls.cameraOn') : t('calls.cameraOff')}>
                  {camOff ? <FiVideoOff className="w-6 h-6" /> : <FiVideo className="w-6 h-6" />}
                </RoundButton>
              )}
              <RoundButton onClick={hangUp} danger label={t('calls.endCall')}>
                <FiPhoneOff className="w-6 h-6" />
              </RoundButton>
            </>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default CallOverlay;
