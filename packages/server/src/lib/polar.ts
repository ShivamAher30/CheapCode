import { Polar } from "@polar-sh/sdk";

type PolarServer = "sandbox" | "production";

function getOptionalEnv(name: string) {
  return process.env[name] || null;
}

export function getPolarAccessToken() {
  return getOptionalEnv("POLAR_ACCESS_TOKEN");
}

export function getPolarProductId() {
  return getOptionalEnv("POLAR_PRODUCT_ID");
}

export function getPolarCreditsMeterId() {
  return getOptionalEnv("POLAR_CREDITS_METER_ID");
}

export function getPolarServer(): PolarServer {
  const server = process.env.POLAR_SERVER;
  if (!server) {
    return "sandbox";
  }

  if (server !== "sandbox" && server !== "production") {
    throw new Error("POLAR_SERVER must be either 'sandbox' or 'production'");
  }

  return server;
}

/** Returns true if Polar billing is configured */
export function isPolarConfigured() {
  return getPolarAccessToken() != null;
}

let _polar: Polar | null = null;

function getPolar(): Polar {
  if (!_polar) {
    const accessToken = getPolarAccessToken();
    if (!accessToken) {
      throw new Error(
        "Polar billing is not configured. Set POLAR_ACCESS_TOKEN to enable billing."
      );
    }
    _polar = new Polar({
      accessToken,
      server: getPolarServer(),
    });
  }
  return _polar;
}

function hasStatusCode(error: unknown): error is { statusCode: number } {
  return (
    typeof error === "object" &&
    error !== null &&
    "statusCode" in error &&
    typeof error.statusCode === "number"
  );
}

type CreateCheckoutUrlParams = {
  customerExternalId: string;
  requestUrl: string;
};

export async function createCheckoutUrl({
  customerExternalId,
  requestUrl,
}: CreateCheckoutUrlParams) {
  const productId = getPolarProductId();
  if (!productId) {
    throw new Error("Polar billing is not configured (missing POLAR_PRODUCT_ID)");
  }

  const result = await getPolar().checkouts.create({
    products: [productId],
    successUrl: new URL("/billing/success", requestUrl).toString(),
    externalCustomerId: customerExternalId,
    metadata: { source: "cheapcode-cli" },
  });

  return result.url;
};

export async function createCustomerPortalUrl({
  customerExternalId,
  requestUrl,
}: CreateCheckoutUrlParams) {
  const result = await getPolar().customerSessions.create({
    externalCustomerId: customerExternalId,
    returnUrl: new URL("/billing/success", requestUrl).toString(),
  });

  return result.customerPortalUrl;
};

export async function getAvailableCreditsBalance(customerExternalId: string) {
  if (!isPolarConfigured()) {
    // If billing isn't configured, allow unlimited usage
    return Infinity;
  }

  try {
    const customerState = await getPolar().customers.getStateExternal({
      externalId: customerExternalId,
    });

    const meterId = getPolarCreditsMeterId();
    const matchingMeters = customerState.activeMeters.filter(
      (meter) => meter.meterId === meterId,
    );

    if (matchingMeters.length > 1) {
      throw new Error("Expected exactly one matching Polar credits meter");
    }

    const creditsMeter = matchingMeters[0];
    return creditsMeter?.balance ?? 0;
  } catch (error) {
    if (hasStatusCode(error) && error.statusCode === 404) {
      return 0;
    }

    throw error;
  }
};

type IngestAiUsageParams = {
  externalCustomerId: string;
  eventId: string;
  credits: number;
};

export async function ingestAiUsage({ 
  externalCustomerId, 
  eventId, 
  credits
}: IngestAiUsageParams) {
  if (credits <= 0 || !isPolarConfigured()) {
    return;
  }

  await getPolar().events.ingest({
    events: [
      {
        name: "cheapcode_usage",
        externalId: eventId,
        externalCustomerId,
        metadata: { credits },
      },
    ],
  });
};

