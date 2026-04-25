import { useEffect, useState } from 'react';
import { useT } from '../i18n';

type Props = {
  selectedDeviceId: string | null;
  onChange: (deviceId: string | null) => void;
  disabled?: boolean;
};

export function DevicePicker({ selectedDeviceId, onChange, disabled }: Props): JSX.Element {
  const t = useT();
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function refresh(): Promise<void> {
      try {
        const probe = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        probe.getTracks().forEach((tr) => tr.stop());
      } catch (err) {
        setPermissionError((err as Error).message ?? t.device.permissionDenied);
        return;
      }
      const all = await navigator.mediaDevices.enumerateDevices();
      if (cancelled) return;
      const inputs = all.filter((d) => d.kind === 'audioinput');
      setDevices(inputs);
      if (selectedDeviceId && !inputs.find((d) => d.deviceId === selectedDeviceId)) {
        onChange(null);
      } else if (!selectedDeviceId && inputs.length > 0) {
        onChange(inputs[0].deviceId);
      }
    }

    void refresh();
    const onChangeDevices = () => void refresh();
    navigator.mediaDevices.addEventListener('devicechange', onChangeDevices);
    return () => {
      cancelled = true;
      navigator.mediaDevices.removeEventListener('devicechange', onChangeDevices);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="field">
      <label>{t.device.label}</label>
      <select
        value={selectedDeviceId ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
        disabled={disabled}
      >
        {devices.length === 0 && <option value="">{t.device.none}</option>}
        {devices.map((d) => (
          <option key={d.deviceId} value={d.deviceId}>
            {d.label || t.device.micFallback(d.deviceId.slice(0, 6))}
          </option>
        ))}
      </select>
      {permissionError && (
        <span className="status-line err">
          <span className="glyph">!</span>
          {permissionError}
        </span>
      )}
    </div>
  );
}
