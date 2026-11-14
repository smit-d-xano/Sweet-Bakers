type Any = any;

export default function ({ $input, $var }: { $input: Any; $var: Any }) {
  const TZ = "America/New_York";
  const SLOTS = ["09:00 - 12:00", "12:00 - 15:00", "15:00 - 18:00"];
  const fail = (error: string) => ({ ok: false, error, address_text: "", order_number: "", delivery_date: "" });

  const today = DateTime.now().setZone(TZ).startOf("day");
  const date = String($input.delivery_date || "");
  const d = DateTime.fromISO(date, { zone: TZ }).startOf("day");
  if (!d.isValid) return fail("Please choose a pickup or delivery date.");
  if (d < today.plus({ days: 1 })) return fail("Orders need at least one day's notice. Pick a later date.");
  if (d > today.plus({ days: 60 })) return fail("Please choose a date within the next 60 days.");
  if (!SLOTS.includes(String($input.delivery_slot || ""))) return fail("Please choose a valid time slot.");

  let address_text = "";
  if ($input.delivery_type === "delivery") {
    const a = $var.address;
    if (!a) return fail("Please choose a delivery address.");
    address_text = [a.line1, a.line2, a.city, `${a.state} ${a.postal_code}`].filter(Boolean).join(", ");
  }

  const stamp = DateTime.now().setZone(TZ).toFormat("yyMMdd");
  const rnd = String(Math.floor(1000 + Math.random() * 9000));
  return { ok: true, error: "", address_text, order_number: `SB-${stamp}-${rnd}`, delivery_date: d.toFormat("yyyy-MM-dd") };
}
