alter type user_role add value if not exists 'attorney';

alter table listing_seller_agreements
  add column if not exists attorney_signed_name text,
  add column if not exists attorney_signature_method text;

update listing_seller_agreements
set attorney_signed_name = coalesce(attorney_signed_name, signed_name)
where attorney_signed_name is null;

update listing_seller_agreements
set attorney_signature_method = coalesce(attorney_signature_method, signature_method)
where attorney_signature_method is null;

alter table listing_seller_agreements
  alter column attorney_signed_name set not null,
  alter column attorney_signature_method set not null;
