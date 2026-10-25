// Pansiyon: evci/çarşı izin defteri ve gece yoklaması (api.js'ten ayrıldı).
// Bağımlılıklar parametre olarak verilir; böylece modül api.js'e geri bağlanmaz.
const push = require('../push');

module.exports = function registerBoarding({ on, q, tx, fail, ok, created, str, requireId, audit, isoDateParam, istanbulNow, visibleClassIds, teachesClass, STAFF }) {
  // ---------- Pansiyon: evci ve çarşı izni defteri (v25) ----------
  const LEAVE_KINDS = { evci: 'Evci izni', carsi: 'Çarşı izni' };
  const LEAVE_SIGNERS = ['ogrenci', 'veli', 'diger'];
  const SIGNER_LABEL = { ogrenci: 'Öğrenci', veli: 'Veli', diger: 'Diğer' };

  async function boardingOn() {
    const { rows: [row] } = await q("select value from app_settings where key = 'boarding'");
    return row?.value === 'true';
  }

  async function requireBoarding() {
    if (!(await boardingOn())) fail(400, 'Okul pansiyonlu olarak ayarlanmamış. Müdür pansiyon modunu açabilir.');
  }

  // İzinleri yönetme yetkisi: müdür, ya da öğrencinin sınıfını okutan öğretmen
  async function requireStaffForStudent(user, studentId) {
    if (user.role === 'principal') return;
    if (user.role !== 'teacher') fail(403, 'Bu işlem için yetkin yok.');
    const { rowCount } = await q('select 1 from enrollments e join teaching t on t.class_id = e.class_id where t.teacher_id = $1 and e.student_id = $2 limit 1', [user.id, studentId]);
    if (!rowCount) fail(403, 'Bu öğrencinin izinlerini yönetme yetkin yok.');
  }

  async function leaveRow(id) {
    const { rows: [row] } = await q(`select l.id, l.student_id, l.kind, l.starts_at, l.ends_at, l.status, l.requested_by,
        u.name as student_name, u.student_no as student_no_value
      from leave_requests l join users u on u.id = l.student_id where l.id = $1`, [id]);
    if (!row) fail(404, 'İzin kaydı bulunamadı.');
    return row;
  }

  // Bildirimler hiçbir zaman işlemi bozmaz: hata yalnızca günlüğe yazılır.
  async function notifyFamily(studentId, payload) {
    try {
      const { rows } = await q('select parent_id from parent_links where student_id = $1', [studentId]);
      await push.notify([studentId, ...rows.map(r => r.parent_id)], payload);
    } catch (error) {
      console.error('İzin bildirimi gönderilemedi:', error.message);
    }
  }

  async function notifyStaff(studentId, payload) {
    try {
      const { rows } = await q(`select distinct t.teacher_id as id from teaching t join enrollments e on e.class_id = t.class_id where e.student_id = $1
        union select id from users where role = 'principal'`, [studentId]);
      await push.notify(rows.map(r => r.id), payload);
    } catch (error) {
      console.error('İzin bildirimi gönderilemedi:', error.message);
    }
  }

  // İmza kaydı: imzalayanın adı, soyadı ve e-imza (PNG). Öğrenci imzalıyorsa öğrenci numarası kayıtla eşleşmelidir.
  function signatureRecord(body, leave) {
    const signer = LEAVE_SIGNERS.includes(body.signerRole) ? body.signerRole : fail(400, 'İmzalayan kişi türü geçersiz.');
    const name = str(body.name, 60);
    const surname = str(body.surname, 60);
    if (!name || !surname) fail(400, 'İmzalayanın adı ve soyadı zorunlu.');
    const studentNo = str(body.studentNo, 20);
    if (signer === 'ogrenci' && (!studentNo || studentNo.toLowerCase() !== String(leave.student_no_value || '').toLowerCase())) {
      fail(400, 'Öğrenci numarası kayıtla eşleşmiyor.');
    }
    const signature = body.signature;
    if (typeof signature !== 'string' || !signature.startsWith('data:image/png;base64,') || signature.length > 150000) {
      fail(400, 'Geçerli bir e-imza gerekli.');
    }
    return { signer, name, surname, studentNo: studentNo || null, signature };
  }

  on('GET', '/api/boarding', async () => ok({ enabled: await boardingOn() }));

  on('PUT', '/api/boarding', async ({ body, user }) => {
    const enabled = body.enabled === true;
    await q(`insert into app_settings (key, value) values ('boarding', $1) on conflict (key) do update set value = excluded.value`, [String(enabled)]);
    await audit(user, 'boarding_changed', 'pansiyon', { enabled });
    return ok({ enabled });
  }, { roles: ['principal'] });

  // Talep: öğrenci kendisi, veli bağlı çocuğu adına. Çıkış-dönüş en fazla 14 gün.
  on('POST', '/api/leaves', async ({ body, user }) => {
    await requireBoarding();
    const studentId = user.role === 'student' ? user.id : requireId(body.studentId, 'öğrenci');
    if (user.role === 'parent') {
      const { rowCount } = await q('select 1 from parent_links where parent_id = $1 and student_id = $2', [user.id, studentId]);
      if (!rowCount) fail(403, 'Bu öğrenci için izin talep edemezsiniz.');
    }
    if (!Object.hasOwn(LEAVE_KINDS, body.kind)) fail(400, 'İzin türü geçersiz.');
    const startsAt = new Date(body.startsAt);
    const endsAt = new Date(body.endsAt);
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) fail(400, 'Çıkış ve dönüş zamanı geçersiz.');
    if (endsAt <= startsAt) fail(400, 'Dönüş zamanı çıkıştan sonra olmalı.');
    if (endsAt - startsAt > 14 * 864e5) fail(400, 'Bir izin en fazla 14 gün olabilir.');
    const reason = str(body.reason, 300);
    const { rows: [row] } = await q(`insert into leave_requests (student_id, kind, starts_at, ends_at, reason, requested_by)
      values ($1, $2, $3, $4, $5, $6) returning id`, [studentId, body.kind, startsAt.toISOString(), endsAt.toISOString(), reason, user.id]);
    const { rows: [student] } = await q('select name from users where id = $1', [studentId]);
    notifyStaff(studentId, { title: 'Yeni izin talebi', body: `${student.name} · ${LEAVE_KINDS[body.kind]} · onayınızı bekliyor`, url: '/#/izin', tag: `izin-talep-${row.id}` });
    return created({ id: row.id });
  }, { roles: ['student', 'parent'] });

  // Liste: öğrenci ve veli kendi kayıtlarını, öğretmen sınıflarını, müdür hepsini görür.
  on('GET', '/api/leaves', async ({ query, user }) => {
    const params = [];
    const conditions = [];
    if (user.role === 'student') {
      params.push(user.id);
      conditions.push(`l.student_id = $${params.length}`);
    } else if (user.role === 'parent') {
      params.push(user.id);
      conditions.push(`l.student_id in (select student_id from parent_links where parent_id = $${params.length})`);
    } else if (user.role === 'teacher') {
      params.push(await visibleClassIds(user));
      conditions.push(`exists (select 1 from enrollments en where en.student_id = l.student_id and en.class_id = any($${params.length}::uuid[]))`);
    }
    const status = query.get('status');
    if (status) {
      params.push(status);
      conditions.push(`l.status = $${params.length}`);
    }
    const where = conditions.length ? conditions.join(' and ') : 'true';
    const { rows } = await q(`select l.id, l.student_id as "studentId", u.name as "studentName", u.student_no as "studentNo", c.name as "className",
        l.kind, l.starts_at as "startsAt", l.ends_at as "endsAt", l.reason, l.status, l.decision_note as "decisionNote", l.requested_by as "requestedBy",
        l.exit_at as "exitAt", l.exit_signer as "exitSigner", l.exit_name as "exitName", l.exit_surname as "exitSurname",
        l.return_at as "returnAt", l.return_signer as "returnSigner", l.return_name as "returnName", l.return_surname as "returnSurname"
      from leave_requests l join users u on u.id = l.student_id
      left join enrollments e on e.student_id = l.student_id left join classes c on c.id = e.class_id
      where ${where} order by l.starts_at desc limit 300`, params);
    // Yetki, onay uç noktasıyla aynı kuraldır: müdür her öğrenci, öğretmen yalnızca öğrettiği sınıfların öğrencileri
    let manageable = null;
    if (user.role === 'teacher') {
      const { rows: mine } = await q('select distinct e.student_id from enrollments e join teaching t on t.class_id = e.class_id where t.teacher_id = $1', [user.id]);
      manageable = new Set(mine.map(m => m.student_id));
    }
    const canManage = r => user.role === 'principal' || (manageable !== null && manageable.has(r.studentId));
    return ok({
      leaves: rows.map(r => ({
        ...r,
        canDecide: canManage(r) && r.status === 'bekliyor',
        canExit: canManage(r) && r.status === 'onaylandi',
        canReturn: canManage(r) && r.status === 'disarida',
        canCancel: r.status === 'bekliyor' && r.requestedBy === user.id,
      })),
    });
  });

  on('POST', '/api/leaves/:id/decide', async ({ params, body, user }) => {
    const leave = await leaveRow(requireId(params.id, 'izin'));
    await requireStaffForStudent(user, leave.student_id);
    if (leave.status !== 'bekliyor') fail(400, 'Bu talep zaten karara bağlanmış.');
    const approve = body.approve === true;
    await q('update leave_requests set status = $2, decided_by = $3, decided_at = now(), decision_note = $4 where id = $1',
      [leave.id, approve ? 'onaylandi' : 'reddedildi', user.id, str(body.note, 200)]);
    await audit(user, approve ? 'leave_approved' : 'leave_rejected', leave.student_name, { kind: leave.kind });
    notifyFamily(leave.student_id, { title: approve ? 'İzin onaylandı' : 'İzin reddedildi', body: `${leave.student_name} · ${LEAVE_KINDS[leave.kind]}`, url: '/#/izin', tag: `izin-karar-${leave.id}` });
    return ok({ status: approve ? 'onaylandi' : 'reddedildi' });
  }, { roles: STAFF });

  on('POST', '/api/leaves/:id/cancel', async ({ params, user }) => {
    const leave = await leaveRow(requireId(params.id, 'izin'));
    if (leave.requested_by !== user.id) fail(403, 'Bu talebi iptal edemezsiniz.');
    if (leave.status !== 'bekliyor') fail(400, 'Yalnızca bekleyen talep iptal edilebilir.');
    await q("update leave_requests set status = 'iptal' where id = $1", [leave.id]);
    return ok({ status: 'iptal' });
  }, { roles: ['student', 'parent'] });

  // Çıkış: onaylı izin, nöbetçi personel e-imzayı alır. Dönüş: dışarıdaki öğrenci için aynı işlem.
  on('POST', '/api/leaves/:id/exit', async ({ params, body, user }) => {
    const leave = await leaveRow(requireId(params.id, 'izin'));
    await requireStaffForStudent(user, leave.student_id);
    if (leave.status !== 'onaylandi') fail(400, 'Çıkış kaydı yalnızca onaylı izin için alınabilir.');
    const sig = signatureRecord(body, leave);
    await q(`update leave_requests set status = 'disarida', exit_at = now(), exit_signer = $2, exit_name = $3, exit_surname = $4,
      exit_student_no = $5, exit_signature = $6, exit_by = $7 where id = $1`, [leave.id, sig.signer, sig.name, sig.surname, sig.studentNo, sig.signature, user.id]);
    await audit(user, 'leave_exit', leave.student_name, { kind: leave.kind, signer: sig.signer });
    notifyFamily(leave.student_id, { title: 'Öğrenci izne çıktı', body: `${leave.student_name} · ${LEAVE_KINDS[leave.kind]} · imzalayan: ${sig.name} ${sig.surname}`, url: '/#/izin', tag: `izin-cikis-${leave.id}` });
    return ok({ status: 'disarida' });
  }, { roles: STAFF });

  on('POST', '/api/leaves/:id/return', async ({ params, body, user }) => {
    const leave = await leaveRow(requireId(params.id, 'izin'));
    await requireStaffForStudent(user, leave.student_id);
    if (leave.status !== 'disarida') fail(400, 'Dönüş kaydı yalnızca dışarıdaki öğrenci için alınabilir.');
    const sig = signatureRecord(body, leave);
    await q(`update leave_requests set status = 'tamamlandi', return_at = now(), return_signer = $2, return_name = $3, return_surname = $4,
      return_student_no = $5, return_signature = $6, return_by = $7 where id = $1`, [leave.id, sig.signer, sig.name, sig.surname, sig.studentNo, sig.signature, user.id]);
    await audit(user, 'leave_return', leave.student_name, { kind: leave.kind, signer: sig.signer });
    notifyFamily(leave.student_id, { title: 'Öğrenci döndü', body: `${leave.student_name} · dönüş imzası: ${sig.name} ${sig.surname}`, url: '/#/izin', tag: `izin-donus-${leave.id}` });
    return ok({ status: 'tamamlandi' });
  }, { roles: STAFF });

  // E-imzalar: yalnızca müdür ve ilgili öğretmen görür
  on('GET', '/api/leaves/:id/signatures', async ({ params, user }) => {
    const leave = await leaveRow(requireId(params.id, 'izin'));
    await requireStaffForStudent(user, leave.student_id);
    const { rows: [s] } = await q(`select exit_signer as "exitSigner", exit_name as "exitName", exit_surname as "exitSurname",
        exit_student_no as "exitStudentNo", exit_at as "exitAt", exit_signature as "exitSignature",
        return_signer as "returnSigner", return_name as "returnName", return_surname as "returnSurname",
        return_student_no as "returnStudentNo", return_at as "returnAt", return_signature as "returnSignature"
      from leave_requests where id = $1`, [leave.id]);
    return ok(s);
  }, { roles: STAFF });

  // Defter dışa aktarımı (CSV, Excel uyumlu)
  on('GET', '/api/leaves/export', async ({ query, user }) => {
    const from = isoDateParam(query.get('from')) || new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
    const to = isoDateParam(query.get('to')) || new Date().toISOString().slice(0, 10);
    const classIds = await visibleClassIds(user);
    const { rows } = await q(`select u.name as "studentName", u.student_no as "studentNo", c.name as "className", l.kind, l.status,
        l.starts_at as "startsAt", l.exit_at as "exitAt", l.exit_signer as "exitSigner", l.exit_name as "exitName",
        l.exit_surname as "exitSurname", l.exit_student_no as "exitStudentNo", l.return_at as "returnAt",
        l.return_name as "returnName", l.return_surname as "returnSurname"
      from leave_requests l join users u on u.id = l.student_id
      left join enrollments e on e.student_id = l.student_id left join classes c on c.id = e.class_id
      where l.starts_at::date between $1 and $2
        and ($3::uuid[] is null or exists (select 1 from enrollments en where en.student_id = l.student_id and en.class_id = any($3::uuid[])))
      order by l.starts_at`, [from, to, classIds]);
    const cell = value => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const when = value => (value ? new Date(value).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' }) : '');
    const lines = ['Öğrenci,Okul no,Sınıf,İzin türü,Başlangıç,Durum,Çıkış zamanı,Çıkışı imzalayan,Çıkış okul no,Dönüş zamanı,Dönüşü imzalayan'];
    for (const r of rows) {
      lines.push([r.studentName, r.studentNo, r.className, LEAVE_KINDS[r.kind], when(r.startsAt), r.status, when(r.exitAt),
        r.exitAt ? `${r.exitName} ${r.exitSurname} (${SIGNER_LABEL[r.exitSigner] || ''})` : '', r.exitStudentNo,
        when(r.returnAt), r.returnAt ? `${r.returnName} ${r.returnSurname}` : ''].map(cell).join(','));
    }
    return { file: { buffer: Buffer.from(`\uFEFF${lines.join('\r\n')}\r\n`, 'utf8'), mime: 'text/csv; charset=utf-8', name: `izin-defteri-${from}-${to}.csv` } };
  }, { roles: STAFF });

  // ---------- Pansiyon: gece yoklaması (v26) ----------
  const NIGHT_STATUSES = ['var', 'yok', 'izinli'];

  // Gece yoklama penceresi: seçilen günün 21:00'i ile ertesi günün 07:00'si (İstanbul saati)
  on('GET', '/api/night-roll', async ({ query, user }) => {
    await requireBoarding();
    const classId = requireId(query.get('classId'), 'sınıf');
    if (user.role !== 'principal' && !(await teachesClass(user, classId))) fail(403, 'Bu sınıfın gece yoklamasını görme yetkin yok.');
    const date = isoDateParam(query.get('date')) || istanbulNow(new Date()).day;
    const { rows: students } = await q(`select u.id, u.name, u.student_no as "studentNo" from enrollments e
      join users u on u.id = e.student_id where e.class_id = $1 order by u.name`, [classId]);
    const ids = students.map(s => s.id);
    const { rows: saved } = await q('select student_id, status from night_roll where roll_date = $1 and student_id = any($2::uuid[])', [date, ids]);
    const { rows: onLeave } = await q(`select distinct student_id from leave_requests
      where status in ('onaylandi', 'disarida') and student_id = any($1::uuid[])
        and starts_at <= (($2::date + time '07:00' + interval '1 day') at time zone 'Europe/Istanbul')
        and ends_at >= (($2::date + time '21:00') at time zone 'Europe/Istanbul')`, [ids, date]);
    const savedMap = new Map(saved.map(r => [r.student_id, r.status]));
    const leaveSet = new Set(onLeave.map(r => r.student_id));
    return ok({
      date,
      students: students.map(s => ({
        ...s,
        status: savedMap.get(s.id) || (leaveSet.has(s.id) ? 'izinli' : null),
        saved: savedMap.has(s.id),
        suggested: !savedMap.has(s.id) && leaveSet.has(s.id) ? 'izinli' : null,
      })),
    });
  });

  on('PUT', '/api/night-roll', async ({ body, user }) => {
    await requireBoarding();
    const classId = requireId(body.classId, 'sınıf');
    if (user.role !== 'principal' && !(await teachesClass(user, classId))) fail(403, 'Bu sınıfın gece yoklamasını kaydetme yetkin yok.');
    const date = isoDateParam(body.date);
    if (!date) fail(400, 'Tarih geçersiz.');
    if (date > istanbulNow(new Date()).day) fail(400, 'Gelecek bir gün için gece yoklaması alınamaz.');
    const records = body.records && typeof body.records === 'object' ? body.records : {};
    const { rows: enrolled } = await q(`select e.student_id, u.name from enrollments e join users u on u.id = e.student_id where e.class_id = $1`, [classId]);
    const names = new Map(enrolled.map(r => [r.student_id, r.name]));
    const entries = Object.entries(records);
    for (const [studentId, status] of entries) {
      if (!names.has(studentId)) fail(400, 'Seçilen öğrenci bu sınıfta değil.');
      if (!NIGHT_STATUSES.includes(status)) fail(400, 'Geçersiz gece yoklama değeri.');
    }
    await tx(async client => {
      for (const [studentId, status] of entries) {
        await client.query(`insert into night_roll (student_id, roll_date, status, recorded_by) values ($1, $2, $3, $4)
          on conflict (student_id, roll_date) do update set status = excluded.status, recorded_by = excluded.recorded_by, recorded_at = now()`,
        [studentId, date, status, user.id]);
      }
    });
    for (const [studentId, status] of entries) {
      if (status === 'yok') notifyFamily(studentId, { title: 'Gece yoklaması', body: `${names.get(studentId)} gece yoklamasında yoklandı (${date})`, url: '/#/cocuklar', tag: `gece-${studentId}-${date}` });
    }
    await audit(user, 'night_roll_saved', date, { classId, count: entries.length });
    return ok({ saved: entries.length });
  });
};
