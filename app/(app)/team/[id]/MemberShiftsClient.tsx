"use client";
import { useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import DateRangePicker, { DateRange } from "@/components/DateRangePicker";
import ShiftTable, { ShiftRow } from "@/components/ShiftTable";

interface Props {
  profileId: string;
  currentUserId: string;
  canEdit: boolean;
  initialYear: number;
  initialMonth: number;
  initialShifts: ShiftRow[];
}

function localISO(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export default function MemberShiftsClient({
  profileId, currentUserId, canEdit, initialYear, initialMonth, initialShifts,
}: Props) {
  const supabase = createClient();

  const [shifts,  setShifts]  = useState<ShiftRow[]>(initialShifts);
  const [loading, setLoading] = useState(false);
  const [range,   setRange]   = useState<DateRange>({
    from: localISO(new Date(initialYear, initialMonth, 1)),
    to:   localISO(new Date(initialYear, initialMonth + 1, 0)),
  });

  const loadShifts = useCallback(async (r: DateRange) => {
    setLoading(true);
    const { data } = await supabase
      .from("time_records")
      .select("id, profile_id, clocked_in_at, clocked_out_at, status, notes")
      .eq("profile_id", profileId)
      .gte("clocked_in_at", r.from + "T00:00:00")
      .lte("clocked_in_at", r.to   + "T23:59:59")
      .order("clocked_in_at", { ascending: false });
    setShifts((data as ShiftRow[]) || []);
    setLoading(false);
  }, [profileId]);

  function handleRangeChange(r: DateRange) {
    setRange(r);
    loadShifts(r);
  }

  return (
    <div>
      <div className="mb-4">
        <DateRangePicker initialRange={range} onChange={handleRangeChange} />
      </div>

      <ShiftTable
        shifts={shifts}
        loading={loading}
        currentUserId={currentUserId}
        canEdit={canEdit}
        onRefresh={() => loadShifts(range)}
      />
    </div>
  );
}
