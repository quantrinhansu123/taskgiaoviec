import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { APP_NAME } from './brand.js';
import { STATUS_META as STATUS_COLORS } from './data.js';
import { localeDateTag, setAppLocale } from './localeRuntime.js';

const STORAGE_KEY = 'taskApp.locale';

export const LOCALES = {
  vi: { id: 'vi', label: 'Tiếng Việt', labelEn: 'Vietnamese' },
  en: { id: 'en', label: 'Tiếng Anh', labelEn: 'English' },
};

const MESSAGES = {
  vi: {
    appName: APP_NAME,
    appTagline: 'Quản lý công việc',
    appTaglineDesktop: 'Giao diện máy tính',
    navProducts: 'Dự án / Projects',
    navSubtasks: 'Sub-task',
    navSchedule: 'Lịch đội',
    navScheduleShort: 'Lịch',
    navAttendance: 'Chấm công',
    navPeople: 'Nhân sự',
    navMe: 'Tôi',
    navSettings: 'Cài đặt',
    settingsTitle: 'Cài đặt',
    settingsLanguage: 'Ngôn ngữ',
    settingsLanguageHint: 'Chọn ngôn ngữ hiển thị giao diện',
    settingsAbout: 'Ứng dụng',
    settingsVersion: 'Phiên bản',
    settingsLayout: 'Giao diện',
    settingsOpenDesktop: 'Mở giao diện máy tính',
    settingsOpenMobile: 'Mở giao diện điện thoại',
    layoutSwitchMobile: 'Giao diện điện thoại',
    back: 'Quay lại',
    save: 'Lưu',
    cancel: 'Hủy',
    search: 'Tìm',
    filter: 'Lọc',
    add: 'Thêm',
    menu: 'Menu',
    list: 'Danh sách',
    all: 'Tất cả',
    statusDone: 'Đạt',
    statusDoing: 'Đang làm',
    statusTodo: 'Chờ',
    statusFail: 'Có lỗi',
    levelProject: 'Dự án',
    levelFeature: 'Hạng mục',
    levelTask: 'Công việc',
    levelSubtask: 'Chi tiết',
    deadlineEmpty: 'Ghi deadline',
    deadlineNone: 'Chưa có',
    unassigned: 'Chưa gán',
    notAssigned: 'Chưa giao việc',
    peopleTitle: 'Nhân sự',
    peopleTeam: 'Đội ngũ',
    peopleMembers: '{count} thành viên',
    peopleOnline: 'Đang online',
    peopleTotalWork: 'Tổng việc',
    peopleOverdue: 'Việc trễ hạn',
    peopleSearch: 'Tìm theo tên, vai trò…',
    productsTitle: 'Tất cả dự án / projects',
    productsGreeting: 'Chào, {name} 👋',
    productsGreetingDefault: 'cả nhà',
    productsRunning: 'Đang chạy',
    productsOpenIssues: 'Lỗi mở',
    productsAchieved: 'Việc đạt',
    productsSearchPlaceholder: 'Tìm theo tên khách hàng hoặc dự án…',
    productsSearchAria: 'Tìm dự án',
    productsViewPeople: 'Xem Nhân sự',
    productsTabCompleted: 'Đã xong',
    productsSelectAllVisible: 'Chọn tất cả đang hiển thị',
    productsDeselectAllVisible: 'Bỏ chọn tất cả',
    productsSelectedCount: '{count} đã chọn',
    productsDeleteSelected: 'Xóa đã chọn',
    productsDeleting: 'Đang xóa…',
    productsEmptySearch: 'Không tìm thấy dự án theo tên khách hàng hoặc tên dự án.',
    productsEmptyTab: 'Không có dự án nào ở mục này.',
    addProject: 'Thêm dự án',
    labelModules: 'hạng mục',
    labelTasks: 'việc',
    labelWorkItems: 'công việc',
    labelErrors: 'lỗi',
    labelPhotos: 'ảnh',
    completedAtShort: 'HT',
    selectAll: 'Chọn tất cả',
    deselectAll: 'Bỏ chọn',
    emptyChildrenInFilter: 'Không có {label} nào ở mục này.',
    statsTotalTasks: 'Tổng việc',
    startDateTimeLabel: 'Ngày giờ bắt đầu',
    noSubtasks: 'Chưa có sub-task.',
    addFirst: 'Thêm {label} đầu tiên',
    sectionDetails: 'Chi tiết',
    addSectionItem: 'Thêm {label}',
    notify: 'Báo',
    printCount: 'In ({count})',
    addSubtask: 'Thêm sub-task',
    meTitle: 'Việc của tôi',
    meCrumb: 'Tôi',
    personDetail: 'Chi tiết nhân sự',
    myAssignedSubtasks: 'Sub-task được phân công',
    assignedWork: 'Việc đang phụ trách',
    work: 'Việc',
    working: 'Đang',
    errorsLate: 'Lỗi/Trễ',
    message: 'Nhắn tin',
    online: 'Online',
    busy: 'Bận',
    offline: 'Offline',
    scheduleTitle: 'Lịch làm việc theo Đội',
    scheduleSub: 'Timeline Gantt — biết ngay đội nào đang ở Job nào',
    attendanceTitle: 'Chấm công',
    attendanceSub: 'Chamcong PSI',
    attendanceOpenNew: 'Mở cửa sổ mới',
    laborReportTitle: 'Báo cáo giờ công',
    laborReportJobTitle: 'Báo cáo giờ công theo Job',
    laborAdminOnly: 'Chỉ Admin mới xem được báo cáo tổng hợp giờ công theo công trình.',
    laborSub: 'Tổng {hours} trên {count} công trình có dữ liệu',
    laborEmpty: 'Chưa có dữ liệu chấm công hoặc hành động nào.',
    checkInQueueTitle: 'Check-in công việc được giao',
    checkInQueueSub: 'Chỉ hiện dự án bạn được phân công. Sau khi check-out hôm nay sẽ không hiện lại.',
    checkIn: 'Check-in',
    checkOut: 'Check-out',
    checkInGpsLoading: 'Đang lấy GPS…',
    checkInFailed: 'Không check-in được',
    checkOutFailed: 'Không check-out được',
    checkInNoGps: 'Chưa có GPS công trình',
    checkInOutsideRadius: 'Bạn đang ngoài bán kính công trình ({radius}m)',
    checkInOutsideSite: 'Ngoài công trình',
    checkInAutoCheckoutSoon: 'Ra khỏi bán kính — sẽ tự check-out…',
    checkInAssignedProject: 'Việc được giao tại dự án này',
    tweaksAppearance: 'Giao diện',
    tweaksAccent: 'Màu nhấn',
    tweaksDensity: 'Mật độ',
    tweaksDisplay: 'Hiển thị',
    tweaksProgress: 'Thanh tiến độ',
    tweaksStats: 'Khối số liệu',
    tweaksRoutes: 'Đường dẫn (URL)',
    loadError: 'Không tải được dữ liệu từ Supabase',
    progressAchieved: '{done}/{total} đạt',
    select: 'Chọn',
    deselect: 'Bỏ chọn',
    options: 'Tùy chọn',
    editPerson: 'Sửa nhân sự',
    call: 'Gọi',
    bulkSelect: 'Chọn nhiều',
    bulkClose: 'Đóng chọn nhiều',
    deleteProjectsConfirm: 'Xóa {count} dự án đã chọn? Toàn bộ hạng mục, công việc và sub-task bên trong cũng sẽ bị xóa.',
    subtasksDone: '{done}/{total} sub task xong',
    minutes: 'phút',
    priority: 'Ưu tiên',
    assignee: 'Người phụ trách',
    deadline: 'Deadline',
    progress: 'Tiến độ',
    status: 'Trạng thái',
    duration: 'Thời gian',
    details: 'Chi tiết',
    openSettings: 'Mở cài đặt',
    workNotesSection: 'Ghi chú / đánh giá / trao đổi',
    workKindNote: 'Ghi chú',
    workKindEvaluation: 'Đánh giá',
    workKindDiscussion: 'Trao đổi',
    discussionEmpty: 'Chưa có tin nhắn. Gõ @ để nhắc tên nhân sự trong dự án.',
    discussionPlaceholder: 'Viết trao đổi… Gõ @ để tag nhân sự',
    discussionSend: 'Gửi',
    discussionMentionHint: 'Gõ @ + tên để tag nhân sự trong dự án này.',
    workKindDocuments: 'Tài liệu',
    workAddKind: 'Thêm {kind}',
    workKindNotePlaceholder: 'Ví dụ: Ghi chú hiện trường, lưu ý thi công…',
    workKindEvaluationPlaceholder: 'Ví dụ: Đánh giá chất lượng, tiến độ, an toàn…',
    workKindDiscussionPlaceholder: 'Ví dụ: Trao đổi với team, khách hàng…',
    workNoteDetail: 'Chi tiết bổ sung',
    workNoteDetailPlaceholder: 'Kết quả, số liệu, hình ảnh mô tả… (tuỳ chọn)',
    workSheetNew: 'Thêm {kind}',
    workSheetEdit: 'Sửa {kind}',
    workKindLabel: 'Loại mục',
    workEmptyHint: 'Chưa có mục nào. Chọn loại bên dưới để thêm.',
    workCompleted: 'Hoàn thành',
    workComplete: 'Hoàn thành',
    workSaving: 'Đang lưu…',
    workSave: 'Lưu',
    workDelete: 'Xóa',
    workStartTime: 'Giờ bắt đầu',
    workNowStart: 'Bây giờ (bắt đầu)',
    workEndRecorded: 'Giờ kết thúc sẽ được ghi nhận khi bạn bấm Hoàn thành.',
    workEndAt: 'Giờ kết thúc: {time}',
    workMainContent: 'Nội dung chính',
    workNoteContent: 'Nội dung ghi chú',
    workErrNote: 'Nhập nội dung ghi chú.',
    workErrTitle: 'Nhập nội dung.',
    workErrDate: 'Chọn ngày bắt đầu.',
    workErrTime: 'Giờ bắt đầu không hợp lệ.',
    generalNote: 'Ghi chú chung',
    addGeneralNote: 'Thêm ghi chú chung cho {label}…',
  },
  en: {
    appName: APP_NAME,
    appTagline: 'Work management',
    appTaglineDesktop: 'Desktop layout',
    navProducts: 'Projects',
    navSubtasks: 'Sub-tasks',
    navSchedule: 'Team schedule',
    navScheduleShort: 'Schedule',
    navAttendance: 'Attendance',
    navPeople: 'People',
    navMe: 'Me',
    navSettings: 'Settings',
    settingsTitle: 'Settings',
    settingsLanguage: 'Language',
    settingsLanguageHint: 'Choose the display language',
    settingsAbout: 'Application',
    settingsVersion: 'Version',
    settingsLayout: 'Layout',
    settingsOpenDesktop: 'Open desktop layout',
    settingsOpenMobile: 'Open mobile layout',
    layoutSwitchMobile: 'Mobile layout',
    back: 'Back',
    save: 'Save',
    cancel: 'Cancel',
    search: 'Search',
    filter: 'Filter',
    add: 'Add',
    menu: 'Menu',
    list: 'List',
    all: 'All',
    statusDone: 'Done',
    statusDoing: 'In progress',
    statusTodo: 'To do',
    statusFail: 'Issues',
    levelProject: 'Project',
    levelFeature: 'Module',
    levelTask: 'Task',
    levelSubtask: 'Sub-task',
    deadlineEmpty: 'Set deadline',
    deadlineNone: 'None',
    unassigned: 'Unassigned',
    notAssigned: 'Not assigned',
    peopleTitle: 'People',
    peopleTeam: 'Team',
    peopleMembers: '{count} members',
    peopleOnline: 'Online now',
    peopleTotalWork: 'Total work',
    peopleOverdue: 'Overdue',
    peopleSearch: 'Search by name, role…',
    productsTitle: 'All projects',
    productsGreeting: 'Hello, {name} 👋',
    productsGreetingDefault: 'team',
    productsRunning: 'Active',
    productsOpenIssues: 'Open issues',
    productsAchieved: 'Completed',
    productsSearchPlaceholder: 'Search by customer or project name…',
    productsSearchAria: 'Search projects',
    productsViewPeople: 'View people',
    productsTabCompleted: 'Completed',
    productsSelectAllVisible: 'Select all visible',
    productsDeselectAllVisible: 'Deselect all',
    productsSelectedCount: '{count} selected',
    productsDeleteSelected: 'Delete selected',
    productsDeleting: 'Deleting…',
    productsEmptySearch: 'No projects match that customer or project name.',
    productsEmptyTab: 'No projects in this tab.',
    addProject: 'Add project',
    labelModules: 'modules',
    labelTasks: 'tasks',
    labelWorkItems: 'work items',
    labelErrors: 'errors',
    labelPhotos: 'photos',
    completedAtShort: 'Done',
    selectAll: 'Select all',
    deselectAll: 'Clear',
    emptyChildrenInFilter: 'No {label} in this tab.',
    statsTotalTasks: 'Total tasks',
    startDateTimeLabel: 'Start date & time',
    noSubtasks: 'No sub-tasks yet.',
    addFirst: 'Add first {label}',
    sectionDetails: 'Details',
    addSectionItem: 'Add {label}',
    notify: 'Notify',
    printCount: 'Print ({count})',
    addSubtask: 'Add sub-task',
    meTitle: 'My work',
    meCrumb: 'Me',
    personDetail: 'Person details',
    myAssignedSubtasks: 'Assigned sub-tasks',
    assignedWork: 'Assigned work',
    work: 'Work',
    working: 'Active',
    errorsLate: 'Issues/Late',
    message: 'Message',
    online: 'Online',
    busy: 'Busy',
    offline: 'Offline',
    scheduleTitle: 'Team work schedule',
    scheduleSub: 'Gantt timeline — see which team is on which job',
    attendanceTitle: 'Attendance',
    attendanceSub: 'Chamcong PSI',
    attendanceOpenNew: 'Open in new window',
    laborReportTitle: 'Labor hours report',
    laborReportJobTitle: 'Labor hours by job',
    laborAdminOnly: 'Only admins can view the consolidated labor hours report.',
    laborSub: 'Total {hours} across {count} jobs with data',
    laborEmpty: 'No attendance or action data yet.',
    checkInQueueTitle: 'Check in to assigned work',
    checkInQueueSub: 'Only jobs assigned to you. After check-out today, they will not appear again.',
    checkIn: 'Check in',
    checkOut: 'Check out',
    checkInGpsLoading: 'Getting GPS…',
    checkInFailed: 'Could not check in',
    checkOutFailed: 'Could not check out',
    checkInNoGps: 'Site GPS not configured',
    checkInOutsideRadius: 'You are outside the site radius ({radius}m)',
    checkInOutsideSite: 'Outside site',
    checkInAutoCheckoutSoon: 'Left site radius — auto check-out soon…',
    checkInAssignedProject: 'Work assigned on this project',
    tweaksAppearance: 'Appearance',
    tweaksAccent: 'Accent color',
    tweaksDensity: 'Density',
    tweaksDisplay: 'Display',
    tweaksProgress: 'Progress bar',
    tweaksStats: 'Stats block',
    tweaksRoutes: 'Routes (URL)',
    loadError: 'Could not load data from Supabase',
    progressAchieved: '{done}/{total} done',
    select: 'Select',
    deselect: 'Deselect',
    options: 'Options',
    editPerson: 'Edit person',
    call: 'Call',
    bulkSelect: 'Multi-select',
    bulkClose: 'Close multi-select',
    deleteProjectsConfirm: 'Delete {count} selected projects? All modules, tasks and sub-tasks inside will also be removed.',
    subtasksDone: '{done}/{total} sub-tasks done',
    minutes: 'min',
    priority: 'Priority',
    assignee: 'Assignee',
    deadline: 'Deadline',
    progress: 'Progress',
    status: 'Status',
    duration: 'Duration',
    details: 'Details',
    openSettings: 'Open settings',
    workNotesSection: 'Notes / evaluations / discussions',
    workKindNote: 'Note',
    workKindEvaluation: 'Evaluation',
    workKindDiscussion: 'Discussion',
    discussionEmpty: 'No messages yet. Type @ to mention someone on this project.',
    discussionPlaceholder: 'Write a message… Type @ to mention',
    discussionSend: 'Send',
    discussionMentionHint: 'Type @ and a name to mention project members.',
    workKindDocuments: 'Documents',
    workAddKind: 'Add {kind}',
    workKindNotePlaceholder: 'e.g. Site note, construction reminder…',
    workKindEvaluationPlaceholder: 'e.g. Quality, progress, or safety review…',
    workKindDiscussionPlaceholder: 'e.g. Discussion with team or client…',
    workNoteDetail: 'Additional details',
    workNoteDetailPlaceholder: 'Results, metrics, context… (optional)',
    workSheetNew: 'Add {kind}',
    workSheetEdit: 'Edit {kind}',
    workKindLabel: 'Entry type',
    workEmptyHint: 'No entries yet. Pick a type below to add one.',
    workCompleted: 'Completed',
    workComplete: 'Complete',
    workSaving: 'Saving…',
    workSave: 'Save',
    workDelete: 'Delete',
    workStartTime: 'Start time',
    workNowStart: 'Now (start)',
    workEndRecorded: 'End time is recorded when you tap Complete.',
    workEndAt: 'End time: {time}',
    workMainContent: 'Main content',
    workNoteContent: 'Note content',
    workErrNote: 'Enter note content.',
    workErrTitle: 'Enter content.',
    workErrDate: 'Pick a start date.',
    workErrTime: 'Invalid start time.',
    generalNote: 'General note',
    addGeneralNote: 'Add a general note for this {label}…',
  },
};

const I18nContext = createContext(null);

function readStoredLocale() {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'en' || stored === 'vi') return stored;
  } catch {
    // ignore
  }
  return 'vi';
}

function writeStoredLocale(locale) {
  try {
    window.localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // ignore
  }
}

function interpolate(template, params = {}) {
  return template.replace(/\{(\w+)\}/g, (_, key) => (
    params[key] != null ? String(params[key]) : `{${key}}`
  ));
}

export function formatTodayHeadline(locale, now = new Date()) {
  const tag = localeDateTag(locale);
  const weekday = now.toLocaleDateString(tag, { weekday: 'long' });
  const prettyWeekday = locale === 'en'
    ? weekday
    : weekday.slice(0, 1).toUpperCase() + weekday.slice(1);
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  return `${prettyWeekday.toUpperCase()} · ${dd} / ${mm}`;
}

function lookup(messages, key) {
  return messages[key] ?? key;
}

const FALLBACK_LOCALE = 'vi';
const FALLBACK_MESSAGES = MESSAGES[FALLBACK_LOCALE];
const FALLBACK_I18N = {
  locale: FALLBACK_LOCALE,
  setLocale: () => {},
  t: (key, params) => {
    const raw = lookup(FALLBACK_MESSAGES, key);
    return params ? interpolate(raw, params) : raw;
  },
  statusMeta: {
    done: { ...STATUS_COLORS.done, label: FALLBACK_MESSAGES.statusDone },
    doing: { ...STATUS_COLORS.doing, label: FALLBACK_MESSAGES.statusDoing },
    todo: { ...STATUS_COLORS.todo, label: FALLBACK_MESSAGES.statusTodo },
    fail: { ...STATUS_COLORS.fail, label: FALLBACK_MESSAGES.statusFail },
  },
  levelLabels: [
    FALLBACK_MESSAGES.levelProject,
    FALLBACK_MESSAGES.levelFeature,
    FALLBACK_MESSAGES.levelTask,
    FALLBACK_MESSAGES.levelSubtask,
  ],
  locales: LOCALES,
};

export function I18nProvider({ children }) {
  const [locale, setLocaleState] = useState(() => {
    const initial = readStoredLocale();
    setAppLocale(initial);
    return initial;
  });

  const setLocale = useCallback((next) => {
    const value = next === 'en' ? 'en' : 'vi';
    writeStoredLocale(value);
    setLocaleState(value);
  }, []);

  const messages = MESSAGES[locale] || MESSAGES.vi;

  const t = useCallback((key, params) => {
    const raw = lookup(messages, key);
    return params ? interpolate(raw, params) : raw;
  }, [messages]);

  const statusMeta = useMemo(() => ({
    done: { ...STATUS_COLORS.done, label: messages.statusDone },
    doing: { ...STATUS_COLORS.doing, label: messages.statusDoing },
    todo: { ...STATUS_COLORS.todo, label: messages.statusTodo },
    fail: { ...STATUS_COLORS.fail, label: messages.statusFail },
  }), [messages]);

  const levelLabels = useMemo(() => [
    messages.levelProject,
    messages.levelFeature,
    messages.levelTask,
    messages.levelSubtask,
  ], [messages]);

  useEffect(() => {
    setAppLocale(locale);
    document.documentElement.lang = locale;
    document.title = `${messages.appName} · ${messages.appTagline}`;
  }, [locale, messages]);

  const value = useMemo(() => ({
    locale,
    setLocale,
    t,
    statusMeta,
    levelLabels,
    locales: LOCALES,
  }), [locale, setLocale, t, statusMeta, levelLabels]);

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    return FALLBACK_I18N;
  }
  return ctx;
}
