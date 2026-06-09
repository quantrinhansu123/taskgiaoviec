/** Locale hiện tại — đồng bộ từ I18nProvider cho formatDeadline và các helper không dùng hook. */
let currentLocale = 'vi';

export function setAppLocale(locale) {
  currentLocale = locale === 'en' ? 'en' : 'vi';
}

export function getAppLocale() {
  return currentLocale;
}

export function localeDateTag(locale = getAppLocale()) {
  return locale === 'en' ? 'en-US' : 'vi-VN';
}
