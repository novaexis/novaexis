CREATE POLICY "reseller_atualiza_status_proprios_leads" 
ON public.leads_comerciais 
FOR UPDATE 
USING (
  (reseller_id IS NOT NULL) AND 
  (reseller_id = (SELECT reseller_id FROM public.profiles WHERE id = auth.uid()))
);