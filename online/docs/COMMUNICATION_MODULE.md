# Communication module (email / WhatsApp ready)

The communication layer is **separate from the solver** and focuses on report generation and contact resolution. No email or WhatsApp API is required for the timetable engine to stay stable.

## What’s in place

### Contact storage
- **Teacher**: `email`, `whatsapp_number` (in teacher table and Teacher dialog).
- **Class teacher**: `school_class.class_teacher_id` links a class to its class teacher (set in Class dialog).

### Communication service (`services/communication_service.py`)
- **`get_teacher_timetable_deliverables()`**  
  Returns a list of all teachers with contact info (teacher_id, teacher_name, email, whatsapp_number). Used for “one PDF per teacher” export and future email/WhatsApp sending.

- **`get_class_teacher_timetable_deliverables()`**  
  Returns classes that have a class teacher set, with that teacher’s contact info (class_id, class_name, class_teacher_id, class_teacher_name, email, whatsapp_number). Used for “one PDF per class for class teacher” export and future delivery.

### Report generation (email/WhatsApp ready)
- **Single-teacher PDF**: `exports/pdf_export.export_single_teacher_pdf(db, teacher_id, path)`  
  One PDF per teacher with timetable and total weekly workload. Suitable for email attachment or future WhatsApp.

- **Single-class PDF**: `exports/pdf_export.export_single_class_pdf(db, class_id, path)`  
  One PDF per class timetable. Suitable for sending to the class teacher.

### Review page — “Communication — email / WhatsApp ready”
- Shows counts: how many teacher timetables and how many class-teacher timetables can be prepared.
- **“Export all teacher PDFs to folder…”**  
  Chooses a folder and writes one PDF per teacher (filename from teacher name). You can then attach/send via your own email or WhatsApp.
- **“Export class timetables for class teachers to folder…”**  
  Chooses a folder and writes one PDF per class (filename like `Class_10A.pdf`). You can send each file to the corresponding class teacher.

## Later: plugging in email / WhatsApp

- **Email**: Add a sender (e.g. SMTP or a service) that takes a list of `(email, path_to_pdf)` and sends. Use `CommunicationService.get_teacher_timetable_deliverables()` / `get_class_teacher_timetable_deliverables()` for addresses and generate PDFs with the existing export functions.
- **WhatsApp**: Same list of deliverables; when you add an API integration, send the same per-teacher or per–class-teacher PDFs (or images) using the `whatsapp_number` field.
- The **solver and generation logic are unchanged**; only the communication layer uses contacts and report paths.

## Design principles

1. **Clean report generation** — One PDF per teacher, one per class (for class teacher); consistent layout and default colors.
2. **Correct mapping** — Teacher ↔ teacher timetable; class ↔ class teacher ↔ class timetable.
3. **Contact fields** — Stored on teacher (email, whatsapp_number) and resolved via CommunicationService.
4. **Modular** — Communication lives in `services/communication_service.py` and export helpers; no dependency on solver or generation code.
