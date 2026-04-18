"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import DatePicker from "@/components/DatePicker";

interface ContractData {
  hoursPerWeek: number | null;
  daysPerWeek: number | null;
  vacationDaysPerYear: number | null;
  salary: number | null;
  contractStart: string | null;
  contractEnd: string | null;
}

interface Props {
  profileId: string;
  canEdit: boolean;
  initial: ContractData;
}

type Field = keyof ContractData;

const FIELD_LABELS: Record<Field, string> = {
  hoursPerWeek:        "Hours / week",
  daysPerWeek:         "Days / week",
  vacationDaysPerYear: "Vacation days / year",
  salary:              "Salary (€)",
  contractStart:       "Contract start",
  contractEnd:         "Contract end",
};

const API_KEYS: Record<Field, string> = {
  hoursPerWeek:        "hours_per_week",
  daysPerWeek:         "days_per_week",
  vacationDaysPerYear: "vacation_days_per_year",
  salary:              "salary",
  contractStart:       "contract_start",
  contractEnd:         "contract_end",
};

function formatValue(field: Field, value: number | string | null): string {
  if (value === null || value === "") return "—";
  if (field === "hoursPerWeek") return `${value}h / week`;
  if (field === "daysPerWeek") return `${value} days / week`;
  if (field === "vacationDaysPerYear") return `${value} days / year`;
  if (field === "salary") return `€${Number(value).toLocaleString("de-DE")}`;
  if (field === "contractStart" || field === "contractEnd") {
    return new Date(value as string).toLocaleDateString("en-GB");
  }
  return String(value);
}

function inputType(field: Field): string {
  if (field === "contractStart" || field === "contractEnd") return "date";
  return "number";
}

function toInputValue(field: Field, value: number | string | null): string {
  if (value === null) return "";
  if ((field === "contractStart" || field === "contractEnd") && typeof value === "string") {
    return value.slice(0, 10);
  }
  return String(value);
}

export default function ContractDetailsClient({ profileId, canEdit, initial }: Props) {
  const router = useRouter();
  const [data, setData] = useState<ContractData>(initial);
  useEffect(() => { setData(initial); }, [initial.contractEnd]);
  const [editing, setEditing] = useState<Field | null>(null);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startEdit(field: Field) {
    if (!canEdit) return;
    setEditing(field);
    setDraft(toInputValue(field, data[field] as number | string | null));
    setError(null);
  }

  function cancelEdit() {
    setEditing(null);
    setDraft("");
    setError(null);
  }

  async function commitEdit(overrideValue?: string | null) {
    if (!editing) return;
    setSaving(true);
    setError(null);

    const isDate = editing === "contractStart" || editing === "contractEnd";
    const rawValue = overrideValue !== undefined ? (overrideValue ?? "") : draft.trim();
    let apiValue: number | string | null = null;

    if (rawValue === "") {
      apiValue = null;
    } else if (isDate) {
      apiValue = rawValue;
    } else {
      const num = parseFloat(rawValue);
      if (isNaN(num) || num < 0) {
        setError("Invalid value");
        setSaving(false);
        return;
      }
      apiValue = num;
    }

    const res = await fetch(`/api/members/${profileId}/contract`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [API_KEYS[editing]]: apiValue }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error || "Save failed");
      setSaving(false);
      return;
    }

    setData(prev => ({ ...prev, [editing]: apiValue }));
    setEditing(null);
    setDraft("");
    setSaving(false);
    router.refresh();
  }

  const fields: Field[] = ["hoursPerWeek", "daysPerWeek", "vacationDaysPerYear", "salary", "contractStart", "contractEnd"];

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
      <h2 className="text-sm font-semibold text-gray-700 mb-4">Contract details</h2>
      <div className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm">
        {fields.map(field => (
          <div key={field}>
            <p className="text-xs text-gray-400 mb-0.5">{FIELD_LABELS[field]}</p>
            {editing === field ? (
              <div className="flex items-center gap-2">
                {field === "contractStart" || field === "contractEnd" ? (
                  <DatePicker
                    value={draft}
                    onChange={date => { setDraft(date); commitEdit(date); }}
                  />
                ) : (
                  <input
                    type="number"
                    value={draft}
                    onChange={e => setDraft(e.target.value)}
                    autoFocus
                    min={0}
                    className="w-32 text-sm border border-gray-200 rounded-lg px-2 py-0.5 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    onKeyDown={e => {
                      if (e.key === "Enter") commitEdit();
                      if (e.key === "Escape") cancelEdit();
                    }}
                  />
                )}
                {(field !== "contractStart" && field !== "contractEnd") && (
                  <>
                    <button onClick={() => commitEdit()} disabled={saving} className="text-xs text-indigo-600 font-semibold disabled:opacity-50">
                      {saving ? "…" : "Save"}
                    </button>
                    <button onClick={cancelEdit} className="text-xs text-gray-400">✕</button>
                  </>
                )}
                {error && <span className="text-xs text-red-500">{error}</span>}
              </div>
            ) : (
              <p
                onClick={() => startEdit(field)}
                className={`font-medium ${
                  canEdit
                    ? "cursor-pointer hover:text-indigo-600 hover:underline underline-offset-2"
                    : ""
                }`}
              >
                {formatValue(field, data[field] as number | string | null)}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
