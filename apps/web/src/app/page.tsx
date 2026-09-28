/**
 * Home shows the install page directly. Must not redirect: older installed
 * service workers follow redirects and browsers reject the result for page loads.
 */
export { default } from './app/page';
