import { format, getYear, isAfter, isBefore, parseISO, subMinutes } from 'date-fns';
import { nb as nbLocale } from 'date-fns/locale';
import slugify from 'slugify';


export const isAfterDateOfYear = (month: number, date: number) => isAfter(new Date(), new Date(getYear(new Date()), month, date, 0, 0, 0));
export const isBeforeDateOfYear = (month: number, date: number) => isBefore(new Date(), new Date(getYear(new Date()), month, date, 0, 0, 0));

/**
 * Slugify a string to make it safe to use in an URL
 * @param text The string the slugify
 */
export const urlEncode = (text = '') => slugify(text, { lower: true, strict: true, locale: 'nb' });

/**
 * Test if an URL points to an external website or an internal page
 *
 * *Examples:*
 * - https://www.tihlde.org -> `true`
 * - /arrangementer/8/ -> `false`
 * @param url The URL to check
 */
export const isExternalURL = (url = '') => url.indexOf(':') > -1 || url.indexOf('//') > -1;

/**
 * Short down string if longer than limit
 * @param string String to shorten
 * @param maxStringLength Max length of returned string
 */


/**
 * Transforms a studyyear to the more readable current class.
 * In 2023, the users which started in 2022, the class is shown as `1. klasse` before the summer and `2. klasse` after the summer.
 * @param studyyear The studyyear
 * @param study Optional study. Used to take eventual DigSam/DigTrans-membership into account.
 * @returns `1. klasse` or `Startet i 2022`
 */


/**
 * Get the user's affiliation as a string.
 *
 * July 15th, users are "moved" up a class as it's the middle of the summer.
 * Ex.: In May 2022, a user in Dataingeniør which started in 2020 is in "2. klasse".
 * In August 2022 the same user is in "3. klasse".
 *
 * Users which started for more than 3 years ago and does not study DigSam is shown as "Startet i <start-year>".
 *
 * @param user the user
 * @returns `Dataingeniør - 2. klasse` or `Dataingeniør - Startet i 2020`
 */




/**
 * Get user study in long version
 * @param userStudy User study



/**
 * Get jobpost type as text
 * @param jobpostType JobPost type
 */


/**
 * Get membership type as text
 * @param membershipType Membership type
 */

/**
 * Format date in format: `Tor 12. okt. 2021 08:30`
 * Year is only shown if it's a different year than this year
 * @param date Date to be formatted
 * @param options Configure what info the formatted date should contain
 */
export const formatDate = (
  date: Date,
  {
    time = true,
    fullMonth = false,
    fullDayOfWeek = false,
    capitalizeFirstLetter = true,
  }: { time?: boolean; fullMonth?: boolean; fullDayOfWeek?: boolean; capitalizeFirstLetter?: boolean } = {},
) => {
  const isDifferentYear = date.getFullYear() !== new Date().getFullYear();
  const formatDateString = `${fullDayOfWeek ? 'EEEE' : 'E'} do ${fullMonth ? 'MMMM' : 'MMM'}${isDifferentYear ? ' yyyy' : ''}`;
  const formatted = format(date, `${formatDateString}${time ? ' p' : ''}`, { locale: nbLocale });
  return capitalizeFirstLetter ? `${formatted.charAt(0).toUpperCase()}${formatted.slice(1)}` : formatted;
};

/**
 * Get time since a date, format: `x sekunder/minutter/timer/dager siden`
 * Returns `formatDate(date)` if more than 7 days ago
 * @param date Date to get time since
 */


/**
 * Transforms a date to when UTC+0 will be at the same time.
 * Ex.: 15:00 in UTC+2 is transformed to 17:00 as UTC+0 at that time will be 15:00
 * @param date - The date to transform
 * @returns A new date
 */
export const dateAsUTC = (date: Date): Date => {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(), date.getMinutes()));
};

/**
 * Transforms a date to UTC+0.
 * Ex.: 15:00 in UTC+2 is transformed to 13:00 as thats the equivalent time in UTC+0
 * @param date - The date to transform
 * @returns A new date
 */
export const dateToUTC = (date: Date): Date => {
  return subMinutes(date, -date.getTimezoneOffset());
};

/**
 * Formats a law header
 * @param law the law
 * @returns String with format: `§1.23 - Title`
 */

/**
 * Create a ICS-file from an event
 * @param event - The event
 * @returns A ICS-string
 */


/**
 * Converts a JSON-object into args which can be transfered in an URL
 * @param data A JSON-object
 * @returns String with format: `?key1=value1&key2=value2`
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any


/**
 * Removes id's from fields and the options of the given fields
 *
 * @param fields The fields to remove the id's from
 */

/**
 * Navigate user to external URL in new tab
 *
 * @param url The URL to navigate to
 */
export const navigateToExternalURL = (url: string) => window.open(url, '_blank');

