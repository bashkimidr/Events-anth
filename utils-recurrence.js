(function () {
    function formatTimeShort(t) {
        if (!t) return '';
        const parts = t.split(':');
        const h = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        const ampm = h >= 12 ? 'PM' : 'AM';
        const hour = h % 12 || 12;
        return m === 0 ? `${hour} ${ampm}` : `${hour}:${String(m).padStart(2, '0')} ${ampm}`;
    }

    function formatDateShort(d) {
        if (!d) return '';
        const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        const parts = d.split('-');
        const mo  = parseInt(parts[1], 10);
        const day = parseInt(parts[2], 10);
        return `${months[mo - 1]} ${day}`;
    }

    window.formatRecurrenceText = function (event) {
        if (event.recurrence_note) return event.recurrence_note;
        if (!event.recurrence_type) return null;
        const time = event.event_time ? ' at ' + formatTimeShort(event.event_time) : '';
        let base;
        if (event.recurrence_type === 'daily') {
            base = 'Daily' + time;
        } else if (event.recurrence_type === 'weekly') {
            const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
            const dayName = days[event.recurrence_day] !== undefined ? days[event.recurrence_day] : 'day';
            base = 'Every ' + dayName + time;
        } else if (event.recurrence_type === 'monthly') {
            const n = Number(event.recurrence_day);
            const suffix = (n === 1 || n === 21 || n === 31) ? 'st'
                         : (n === 2 || n === 22)             ? 'nd'
                         : (n === 3 || n === 23)             ? 'rd'
                         : 'th';
            base = n + suffix + ' of every month' + time;
        } else {
            return null;
        }
        if (event.recurrence_end_date) {
            base += ' until ' + formatDateShort(event.recurrence_end_date);
        }
        return base;
    };
})();
