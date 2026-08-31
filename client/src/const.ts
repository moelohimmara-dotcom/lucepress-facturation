export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// Redirect to the login/register page. Replaces the former Manus OAuth flow.
export const startLogin = () => {
  window.location.href = "/connexion";
};
