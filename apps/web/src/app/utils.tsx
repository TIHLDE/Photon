import { format, getYear, isAfter, isBefore, parseISO, subMinutes } from 'date-fns';
import { nb as nbLocale } from 'date-fns/locale';
//import slugify from 'slugify';
import { FormFieldType, JobPostType, MembershipType, StrikeReason, Study, UserClass, UserStudy } from '../types/Enums';

export const isAfterDateOfYear = (month: number, date: number) => isAfter(new Date(), new Date(getYear(new Date()), month, date, 0, 0, 0));
export const isBeforeDateOfYear = (month: number, date: number) => isBefore(new Date(), new Date(getYear(new Date()), month, date, 0, 0, 0));

/**
 * Slugify a string to make it safe to use in an URL
 * @param text The string the slugify
 */
//export const urlEncode = (text = '') => slugify(text, { lower: true, strict: true, locale: 'nb' });

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
export const shortDownString = (string: string, maxStringLength: number) => {
  let result = string;
  if (string.length > maxStringLength) {
    result = `${string.slice(0, maxStringLength)}...`;
  }
  return result;
};


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
 * Get user study in shortened version
 * @param userStudy User study
 */
export const getUserStudyShort = (userStudy: UserStudy) => {
  switch (userStudy) {
    case UserStudy.DATAING:
      return 'Dataing';
    case UserStudy.DIGFOR:
      return 'DigFor';
    case UserStudy.DIGSEC:
      return 'DigSec';
    case UserStudy.DIGSAM:
      return 'DigSam';
    case UserStudy.DRIFT:
      return 'Drift';
    case UserStudy.INFO:
      return 'Info';
    default:
      return 'Ukjent studie';
  }
};

/**
 * Get user study in long version
 * @param userStudy User study
 */
export const getUserStudyLong = (userStudy: UserStudy) => {
  switch (userStudy) {
    case UserStudy.DATAING:
      return 'Dataingeniør';
    case UserStudy.DIGFOR:
      return 'Digital forretningsutvikling';
    case UserStudy.DIGSEC:
      return 'Digital infrastruktur og cybersikkerhet';
    case UserStudy.DIGSAM:
      return 'Digital transformasjon';
    case UserStudy.DRIFT:
      return 'Drift av datasystemer';
    case UserStudy.INFO:
      return 'Informasjonsbehandling';
    default:
      return 'Ukjent studie';
  }
};

/**
 * Get user class as text
 * @param userClass User class
 */
export const getUserClass = (userClass: UserClass) => {
  switch (userClass) {
    case UserClass.ALUMNI:
      return 'Alumni';
    case UserClass.FIRST:
      return '1. klasse';
    case UserClass.SECOND:
      return '2. klasse';
    case UserClass.THIRD:
      return '3. klasse';
    case UserClass.FOURTH:
      return '4. klasse';
    case UserClass.FIFTH:
      return '5. klasse';
    default:
      return 'Ukjent klasse';
  }
};

/**
 * Get jobpost type as text
 * @param jobpostType JobPost type
 */
export const getJobpostType = (jobpostType: JobPostType) => {
  switch (jobpostType) {
    case JobPostType.PART_TIME:
      return 'Deltid';
    case JobPostType.FULL_TIME:
      return 'Fulltid';
    case JobPostType.SUMMER_JOB:
      return 'Sommerjobb';
    case JobPostType.OTHER:
      return 'Annet';
    default:
      return 'Ukjent jobbtype';
  }
};

/**
 * Get membership type as text
 * @param membershipType Membership type
 */
export const getMembershipType = (membershipType: MembershipType) => {
  switch (membershipType) {
    case MembershipType.LEADER:
      return 'Leder';
    case MembershipType.MEMBER:
      return 'Medlem';
    default:
      return 'Ukjent medlemskapstype';
  }
};

/**
 * Get strike reason as readable text
 * @param strikeReason Strike reason enum
 */
export const getStrikeReasonAsText = (strikeReason: StrikeReason) => {
  switch (strikeReason) {
    case StrikeReason.BAD_BEHAVIOR:
      return 'Upassende oppførsel (1 prikk)';
    case StrikeReason.EVAL_FORM:
      return 'Ikke svart på evalueringsskjema (3 prikk)';
    case StrikeReason.LATE:
      return 'Møtte for sent (1 prikk)';
    case StrikeReason.NO_SHOW:
      return 'Møtte ikke (2 prikk)';
    case StrikeReason.PAST_DEADLINE:
      return 'Meldt av etter avmeldingsfrist (1 prikk)';
    default:
      return 'Ukjent grunn til prikk';
  }
};

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
export const argsToParams = (data: Record<string, string | number | boolean | Array<string | number | boolean>>) => {
  let args = '?';
  for (const key in data) {
    if (Array.isArray(data[key])) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const value in data[key] as (string | number | boolean)[]) {
        args += `&${key}=${data[key][value]}`;
      }
    } else if (!(data[key] === undefined || (typeof data[key] === 'string' && data[key].trim().length === 0))) {
      args += `&${key}=${data[key]}`;
    }
  }
  return args;
};

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

/**
 * Parse a paragraph string to a number with two decimals at most and prefixed with a zero if it's a single digit decimal
 *
 * Examples:
 * - "3" -> 3
 * - "3.1" -> 3.01
 * - "3.12" -> 3.12
 *
 * @param input The input string
 * @returns The parsed number
 */
