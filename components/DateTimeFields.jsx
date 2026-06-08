/** Ô nhập ngày + giờ dùng chung (deadline, lịch đội, bắt đầu công trình…). */
export function DateTimeFields({
  label,
  dateId,
  timeId,
  date,
  time,
  onDateChange,
  onTimeChange,
  note,
  required = false,
}) {
  return (
    <div className="field">
      <span className="field-label">
        {label}
        {required && ' *'}
      </span>
      <div className="field-datetime-row">
        <input
          id={dateId}
          className="field-input"
          type="date"
          value={date}
          onChange={(e) => onDateChange(e.target.value)}
          required={required}
        />
        <input
          id={timeId}
          className="field-input field-input--time"
          type="time"
          value={time}
          onChange={(e) => onTimeChange(e.target.value)}
          step={60}
        />
      </div>
      {note && <p className="field-note">{note}</p>}
    </div>
  );
}
