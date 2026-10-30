# AJTCG Stock & VAT (proof of concept)

Static front end for GitHub Pages, backed by Supabase.

## Setup
1. Create a Supabase project and run the table SQL (purchase_lots, stock_items, sales).
2. Enable Row Level Security on every table and add a policy allowing only signed-in users, e.g.
   `create policy "staff" on stock_items for all to authenticated using (true) with check (true);`
   Repeat for `sales` and `purchase_lots`.
3. Authentication > Users: add a staff user (email + password). Turn off public sign-ups.
4. Put your project URL and anon key in `js/config.js`.
5. Push this folder to a GitHub repo, then Settings > Pages > deploy from the main branch.

## Theme
Colours live in `:root` at the top of `css/style.css`. Swap in the shop's palette and logo there.

## Notes
- Money is stored as integer pence. VAT shown is an estimate; confirm scheme rules with the shop's accountant.
- Use fake data for the demo.
