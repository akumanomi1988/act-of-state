-- ACT OF STATE | Second fictional introductory dossier.
-- This is original editorial simulation content, not a current-news claim.
insert into public.dossiers
 (id,version,title,context,category,release_kind)
values
 ('water-security',1,'Plan de seguridad hídrica',
  'Escenario ficticio: una sequía prolongada obliga al gobierno a equilibrar el consumo doméstico, la modernización industrial y la sostenibilidad de las cuentas públicas.',
  'Territorio y recursos','intro');

insert into public.dossier_options
 (dossier_id,dossier_version,id,title,description,treasury_delta_m_eur,
  policy_target,response_intensity,trust_base_delta)
values
 ('water-security',1,'household-efficiency','Proteger el suministro doméstico',
  'Financiar ahorro y renovación de redes en barrios y municipios.',
  -650,25,25,1),
 ('water-security',1,'industrial-reuse','Modernizar el uso industrial del agua',
  'Cofinanciar recirculación y eficiencia hídrica en instalaciones productivas.',
  -950,75,30,0),
 ('water-security',1,'conserve-reserves','Preservar las reservas fiscales',
  'Aplazar nuevas inversiones y reforzar el margen presupuestario.',
  150,50,10,-1);
