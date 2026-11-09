import React from "react";
import { ProviderId } from "../../types/providers";
import { ProviderSettingsView } from "../settings/ProviderSettingsView";

interface BYOKModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProviderConfigUpdated: () => void;
  initialProviderId?: ProviderId;
}

export const BYOKModal: React.FC<BYOKModalProps> = ({
  isOpen,
  onClose,
  onProviderConfigUpdated,
  initialProviderId = "gemini",
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      <div className="w-full max-w-5xl my-auto">
        <ProviderSettingsView
          onClose={onClose}
          onProviderConfigUpdated={onProviderConfigUpdated}
          initialProviderId={initialProviderId}
        />
      </div>
    </div>
  );
};
