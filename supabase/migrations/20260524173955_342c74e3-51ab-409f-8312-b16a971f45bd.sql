-- Chat tables: allow read for everyone (realtime + visitor fetch by unguessable UUID);
-- writes are server-only via service role.
CREATE POLICY "chat_channels_select_all" ON public.chat_channels
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "chat_messages_select_all" ON public.chat_messages
  FOR SELECT TO anon, authenticated USING (true);

-- Lock down tables that are only ever touched by the server (service role bypasses RLS).
-- Explicit deny policies make intent clear and satisfy security scanners.
CREATE POLICY "admin_actions_no_client_access" ON public.admin_actions
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

CREATE POLICY "diagnostic_events_no_client_access" ON public.diagnostic_events
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

CREATE POLICY "discount_codes_no_client_access" ON public.discount_codes
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

CREATE POLICY "orders_no_client_access" ON public.orders
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

CREATE POLICY "order_items_no_client_access" ON public.order_items
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

CREATE POLICY "site_content_no_client_access" ON public.site_content
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

CREATE POLICY "site_pages_no_client_access" ON public.site_pages
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);