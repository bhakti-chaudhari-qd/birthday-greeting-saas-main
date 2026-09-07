export const AUTHENTICATED_LANDING_PATH = "/dashboard";

export function navigateToAuthenticatedLanding(): void {
  window.location.assign(AUTHENTICATED_LANDING_PATH);
}
