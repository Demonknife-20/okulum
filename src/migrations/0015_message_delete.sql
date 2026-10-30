-- v?: mesaj geri çağırma (silme). Gönderen kendi mesajını silebilir; içerik kaldırılır,
-- iz bırakılmaması için body bir yer tutucuyla değiştirilir ve deleted_at damgası atanır.
alter table messages add column if not exists deleted_at timestamptz;
