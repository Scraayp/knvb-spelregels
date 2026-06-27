import type { Settings, TimeMode, SelectionMode, ThemePref } from "../types";
import { RULES, TAGS, ruleLabel } from "../data";

interface Props {
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
  onResetProgress: () => void;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-zinc-600 dark:text-zinc-300">
        {label}
      </span>
      {children}
    </label>
  );
}

const selectCls =
  "w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm dark:border-white/10 dark:bg-white/5";

const SESSION_SIZES = [10, 15, 20, 30, 50];

export function SettingsPanel({ settings, onChange, onResetProgress }: Props) {
  return (
    <div className="grid gap-5">
      <Field label="Aantal vragen per sessie">
        <select
          className={selectCls}
          value={settings.sessionSize ?? "all"}
          onChange={(e) =>
            onChange({
              sessionSize: e.target.value === "all" ? null : Number(e.target.value),
            })
          }
        >
          {SESSION_SIZES.map((n) => (
            <option key={n} value={n}>
              {n} vragen
            </option>
          ))}
          <option value="all">Onbeperkt</option>
        </select>
      </Field>

      <Field label="Tijdslimiet">
        <select
          className={selectCls}
          value={settings.timeMode}
          onChange={(e) => onChange({ timeMode: e.target.value as TimeMode })}
        >
          <option value="none">Geen limiet (stopwatch)</option>
          <option value="perQuestion">Per vraag</option>
          <option value="total">Voor hele sessie</option>
        </select>
      </Field>

      {settings.timeMode === "perQuestion" && (
        <Field label={`Seconden per vraag: ${settings.perQuestionSeconds}`}>
          <input
            type="range"
            min={10}
            max={90}
            step={5}
            value={settings.perQuestionSeconds}
            onChange={(e) => onChange({ perQuestionSeconds: Number(e.target.value) })}
            className="w-full accent-pitch-500"
          />
        </Field>
      )}

      {settings.timeMode === "total" && (
        <Field label={`Totale tijd: ${Math.round(settings.totalSeconds / 60)} min`}>
          <input
            type="range"
            min={60}
            max={1800}
            step={60}
            value={settings.totalSeconds}
            onChange={(e) => onChange({ totalSeconds: Number(e.target.value) })}
            className="w-full accent-pitch-500"
          />
        </Field>
      )}

      <Field label="Selectie">
        <select
          className={selectCls}
          value={settings.selection}
          onChange={(e) => onChange({ selection: e.target.value as SelectionMode })}
        >
          <option value="random">Willekeurig</option>
          <option value="weak">Focus op zwakke punten</option>
        </select>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Regel">
          <select
            className={selectCls}
            value={settings.ruleFilter ?? "all"}
            onChange={(e) =>
              onChange({
                ruleFilter: e.target.value === "all" ? null : Number(e.target.value),
              })
            }
          >
            <option value="all">Alle regels</option>
            {RULES.map((r) => (
              <option key={r} value={r}>
                {ruleLabel(r)}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Onderwerp">
          <select
            className={selectCls}
            value={settings.tagFilter ?? "all"}
            onChange={(e) =>
              onChange({ tagFilter: e.target.value === "all" ? null : e.target.value })
            }
          >
            <option value="all">Alle onderwerpen</option>
            {TAGS.map((t) => (
              <option key={t} value={t}>
                #{t}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Thema">
        <div className="grid grid-cols-3 gap-2">
          {(["system", "light", "dark"] as ThemePref[]).map((t) => (
            <button
              key={t}
              onClick={() => onChange({ theme: t })}
              className={
                "rounded-xl border px-3 py-2 text-sm font-medium capitalize transition " +
                (settings.theme === t
                  ? "border-pitch-500 bg-pitch-500/10 text-pitch-600 dark:text-pitch-400"
                  : "border-zinc-200 dark:border-white/10")
              }
            >
              {t === "system" ? "Systeem" : t === "light" ? "Licht" : "Donker"}
            </button>
          ))}
        </div>
      </Field>

      <button
        onClick={onResetProgress}
        className="mt-2 rounded-xl border border-red-200 py-2.5 text-sm font-medium text-red-600 transition hover:bg-red-50 dark:border-red-500/30 dark:hover:bg-red-500/10"
      >
        Voortgang wissen
      </button>
    </div>
  );
}
