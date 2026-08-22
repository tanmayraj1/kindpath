/**
 * The one brand hex that has to be written by hand.
 *
 * Everything rendered by the browser reads the palette from CSS variables in
 * `src/app/globals.css`. Four things can't: email clients (no CSS vars), the
 * PDF receipt/invoice renderers, the generated QR code, and the Open Graph
 * image. They used to each carry their own literal, which is how the pre-reskin
 * indigo (#4f46e5) outlived the reskin in receipts and QR codes. Import this
 * instead.
 */
export const BRAND_HEX = "#1F7A6D";
