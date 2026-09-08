type ShipmentInput = {
  receiver: { email: string; phone: string; firstName: string; lastName: string };
  parcelLockerId: string;
  reference: string;
};

/** Server-side ShipX adapter. Keep the token out of browser code. */
export async function createInpostShipment(input: ShipmentInput) {
  const token = process.env["INPOST_TOKEN"];
  if (!token) throw new Error("INPOST_TOKEN is not configured");
  const baseUrl = process.env["INPOST_API_URL"] ?? "https://api-shipx-pl.easypack24.net/v1";
  const response = await fetch(`${baseUrl}/organizations/me/shipments`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      receiver: {
        email: input.receiver.email,
        phone: input.receiver.phone,
        first_name: input.receiver.firstName,
        last_name: input.receiver.lastName,
      },
      parcel: { template: "small" },
      service: "inpost_locker_standard",
      custom_attributes: { target_point: input.parcelLockerId },
      reference: input.reference,
    }),
  });
  if (!response.ok) throw new Error(`InPost shipment failed: ${response.status}`);
  return response.json();
}
