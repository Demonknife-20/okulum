-- İki adımlı doğrulama: aynı 30 saniyelik kod iki kez kullanılamaz
alter table users add column if not exists totp_last_step bigint;
