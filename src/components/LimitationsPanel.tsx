import { Card, SectionTitle } from './ui';
import { EvidenceLegend } from './EvidenceBadge';
import { t } from '../i18n';

const LIMITATION_KEYS = [
  'allTime',
  'shrink',
  'ranges',
  'gap',
  'five',
  'rename',
  'noType',
  'missing',
  'tz',
] as const;

export function LimitationsPanel() {
  return (
    <div className="space-y-5">
      <div>
        <SectionTitle>{t('settings.limitationsTitle')}</SectionTitle>
        <div className="space-y-3">
          {LIMITATION_KEYS.map((key) => (
            <Card key={key} className="p-4">
              <h3 className="text-sm font-semibold text-ink-100">{t(`limitation.${key}Title`)}</h3>
              <p className="mt-1 text-sm text-ink-400">{t(`limitation.${key}Body`)}</p>
            </Card>
          ))}
        </div>
      </div>

      <div>
        <SectionTitle>{t('settings.labelsTitle')}</SectionTitle>
        <Card className="p-4">
          <EvidenceLegend />
        </Card>
      </div>
    </div>
  );
}
