import type { FnSpec } from '../types.ts';

const d = (name: string, signature: string, summary: string, cases: FnSpec['cases']): FnSpec => ({ name, category: 'date', signature, summary, cases });

// Serials used below: 43845 = 2020-01-15 (a Wednesday), 43861 = 2020-01-31, 43890 = 2020-02-29, 44197 = 2021-01-01.
export const date: FnSpec[] = [
  d('DATE', 'DATE(year, month, day)', 'Returns the serial number of a date; months and days outside their range roll over, and years 0-1899 are added to 1900.', [
    '=DATE(2020, 1, 15)', '=DATE(2008, 14, 2)', '=DATE(2020, 3, 0)', '=DATE(2020, 1, -5)', { f: '=DATE(108, 1, 2)', expect: 39449, why: 'years 0-1899 are added to 1900' }, '=DATE(2020.9, 1.5, 15.9)', '=DATE(-1, 1, 1)', { f: '=DATE(10000, 1, 1)', expect: { error: '#NUM!' }, why: 'year above 9999' }, '=DATE("x", 1, 1)',
  ]),
  d('DATEVALUE', 'DATEVALUE(date_text)', 'Converts a date written as text to its serial number.', [
    '=DATEVALUE("2020-01-15")', '=DATEVALUE("1/15/2020")', '=DATEVALUE("15-Jan-2020")', { f: '=DATEVALUE("January 15, 2020")', expect: 43845, why: 'month-name format' },
    { f: '=DATEVALUE("2020-02-30")', expect: { error: '#VALUE!' }, why: 'no such date' }, { f: '=DATEVALUE("hello")', expect: { error: '#VALUE!' }, why: 'not a date' },
    { f: '=DATEVALUE(43845)', expect: { error: '#VALUE!' }, why: 'the argument must be text' },
  ]),
  d('DAY', 'DAY(serial_number)', 'Returns the day of the month (1-31) of a date serial.', ['=DAY(43845)', '=DAY(43861.75)', '=DAY(DATE(2020, 2, 29))', '=DAY(1)', '=DAY(-1)', '=DAY("x")']),
  d('MONTH', 'MONTH(serial_number)', 'Returns the month (1-12) of a date serial.', ['=MONTH(43845)', '=MONTH(43890)', '=MONTH(DATE(2021, 12, 31))', '=MONTH(1)', '=MONTH(-1)', '=MONTH("x")']),
  d('YEAR', 'YEAR(serial_number)', 'Returns the year of a date serial.', ['=YEAR(43845)', '=YEAR(44197)', '=YEAR(DATE(1999, 12, 31))', '=YEAR(1)', '=YEAR(-1)', '=YEAR("x")']),
  d('DAYS', 'DAYS(end_date, start_date)', 'Returns the number of days between two dates.', ['=DAYS(44197, 43845)', '=DAYS(43845, 44197)', '=DAYS(43845.9, 43845.1)', '=DAYS(DATE(2021, 3, 15), DATE(2021, 2, 1))', '=DAYS("x", 1)']),
  d('DAYS360', 'DAYS360(start_date, end_date, [method])', 'Returns the days between two dates on a 360-day year (US method by default, European when method is TRUE).', [
    '=DAYS360(DATE(2020, 1, 1), DATE(2021, 1, 1))', '=DAYS360(43861, DATE(2020, 3, 31))', '=DAYS360(43890, DATE(2020, 3, 31))', '=DAYS360(43890, DATE(2020, 3, 31), TRUE)', '=DAYS360(DATE(2020, 1, 30), DATE(2020, 3, 31))', '=DAYS360(44197, 43845)', '=DAYS360("x", 1)',
  ]),
  d('EDATE', 'EDATE(start_date, months)', 'Returns the date that is a number of months before or after a date (clamped to the end of shorter months).', [
    '=EDATE(43845, 1)', '=EDATE(43845, -1)', '=EDATE(43861, 1)', '=EDATE(43845, 12)', { f: '=EDATE(43845, 1.9)', expect: 43876, why: 'months is truncated' }, { f: '=EDATE(43845, -1.9)', expect: 43814, why: 'months is truncated toward zero' }, '=EDATE("x", 1)',
  ]),
  d('EOMONTH', 'EOMONTH(start_date, months)', 'Returns the last day of the month a number of months before or after a date.', [
    '=EOMONTH(43845, 0)', '=EOMONTH(43845, 1)', '=EOMONTH(43845, -1)', '=EOMONTH(43890, 12)', { f: '=EOMONTH(43845, 1.9)', expect: 43890, why: 'months is truncated' }, '=EOMONTH(-1, 1)', '=EOMONTH("x", 1)',
  ]),
  d('HOUR', 'HOUR(serial_number)', 'Returns the hour (0-23) of a time serial.', ['=HOUR(0.75)', '=HOUR(43845.5)', '=HOUR(0.99999)', '=HOUR(0)', '=HOUR(-1)', '=HOUR("x")']),
  d('MINUTE', 'MINUTE(serial_number)', 'Returns the minute (0-59) of a time serial.', ['=MINUTE(0.75)', '=MINUTE(TIME(10, 25, 59))', '=MINUTE(0.0104166666666667)', '=MINUTE(43845.51)', '=MINUTE(-1)', '=MINUTE("x")']),
  d('SECOND', 'SECOND(serial_number)', 'Returns the second (0-59) of a time serial.', ['=SECOND(TIME(10, 25, 59))', '=SECOND(0.5)', '=SECOND(0.000115740740740741)', '=SECOND(43845.51)', '=SECOND(-1)', '=SECOND("x")']),
  d('TIME', 'TIME(hour, minute, second)', 'Returns the fraction of a day for a time; components roll over and whole days are dropped.', ['=TIME(12, 0, 0)', '=TIME(16, 48, 10)', '=TIME(0, 90, 0)', { f: '=TIME(25, 0, 0)', expect: 0.041666666666666664, why: 'whole days are dropped' }, '=TIME(0, 0, -1)', { f: '=TIME(10.9, 30.5, 0)', expect: 0.4375, why: 'components are truncated' }, '=TIME("x", 0, 0)']),
  d('TIMEVALUE', 'TIMEVALUE(time_text)', 'Converts a time written as text to a fraction of a day.', [
    { f: '=TIMEVALUE("12:00")', expect: 0.5, why: 'formula.js cannot read plain times' }, { f: '=TIMEVALUE("6:35 PM")', expect: 0.7743055555555556, why: 'formula.js cannot read plain times' }, { f: '=TIMEVALUE("18:35:15")', expect: 0.7744791666666667, why: 'formula.js cannot read plain times' }, { f: '=TIMEVALUE("2020-01-15 06:00")', expect: 0.25, why: 'a leading date is ignored' },
    { f: '=TIMEVALUE("25:00")', expect: { error: '#VALUE!' }, why: 'no such time' }, { f: '=TIMEVALUE("noon")', expect: { error: '#VALUE!' }, why: 'not a time' },
  ]),
  d('WEEKDAY', 'WEEKDAY(serial_number, [return_type])', 'Returns the day of the week of a date (return_type 1: Sunday=1, 2: Monday=1, 3: Monday=0, 11-17: week starting Monday..Sunday).', [
    '=WEEKDAY(43845)', '=WEEKDAY(43845, 2)', '=WEEKDAY(43845, 3)', '=WEEKDAY(43845, 11)', '=WEEKDAY(43845, 16)', '=WEEKDAY(43842)', { f: '=WEEKDAY(43845, 4)', expect: { error: '#NUM!' }, why: 'invalid return_type' }, '=WEEKDAY(-1)',
  ]),
  d('WEEKNUM', 'WEEKNUM(serial_number, [return_type])', 'Returns the week of the year of a date; the week containing January 1 is week 1 (weeks start on Sunday for return_type 1, Monday for 2, 11-17 as in WEEKDAY).', [
    '=WEEKNUM(DATE(2020, 1, 1))', '=WEEKNUM(DATE(2020, 1, 5))', '=WEEKNUM(DATE(2020, 1, 5), 2)', '=WEEKNUM(DATE(2020, 12, 31))', { f: '=WEEKNUM(DATE(2021, 3, 9), 11)', expect: 11, why: 'return_type 11 starts weeks on Monday' }, '=WEEKNUM(DATE(2021, 3, 9), 17)', '=WEEKNUM(43845, 5)',
  ]),
  d('ISOWEEKNUM', 'ISOWEEKNUM(date)', 'Returns the ISO 8601 week number of a date (weeks start on Monday; week 1 contains the first Thursday of the year).', [
    '=ISOWEEKNUM(DATE(2020, 1, 1))', '=ISOWEEKNUM(DATE(2021, 1, 1))', '=ISOWEEKNUM(DATE(2021, 1, 4))', '=ISOWEEKNUM(DATE(2020, 12, 31))', '=ISOWEEKNUM(DATE(2015, 12, 31))', '=ISOWEEKNUM(43845)', '=ISOWEEKNUM(-1)',
  ]),
  d('NETWORKDAYS', 'NETWORKDAYS(start_date, end_date, [holidays])', 'Returns the number of working days (Monday-Friday, excluding holidays) between two dates, inclusive.', [
    '=NETWORKDAYS(DATE(2020, 1, 1), DATE(2020, 1, 31))', { f: '=NETWORKDAYS(DATE(2020, 1, 1), DATE(2020, 1, 31), {43845, 43846})', expect: 21, why: 'holidays given as an array' }, { f: '=NETWORKDAYS(DATE(2020, 1, 31), DATE(2020, 1, 1))', expect: -23, why: 'end before start gives the negative count' }, '=NETWORKDAYS(43841, 43842)', '=NETWORKDAYS(43845, 43845)', '=NETWORKDAYS("x", 1)',
  ]),
  d('NETWORKDAYS.INTL', 'NETWORKDAYS.INTL(start_date, end_date, [weekend], [holidays])', 'Returns the number of working days between two dates, inclusive, with a custom weekend (number 1-7, 11-17 or a 7-character "0000011" mask starting Monday).', [
    '=NETWORKDAYS.INTL(DATE(2020, 1, 1), DATE(2020, 1, 31))', '=NETWORKDAYS.INTL(DATE(2020, 1, 1), DATE(2020, 1, 31), 7)', '=NETWORKDAYS.INTL(DATE(2020, 1, 1), DATE(2020, 1, 31), 11)', '=NETWORKDAYS.INTL(DATE(2020, 1, 1), DATE(2020, 1, 31), "0000110")',
    '=NETWORKDAYS.INTL(DATE(2020, 1, 1), DATE(2020, 1, 31), 1, {43845})', { f: '=NETWORKDAYS.INTL(DATE(2020, 1, 31), DATE(2020, 1, 1), 1)', expect: -23, why: 'end before start gives the negative count' }, { f: '=NETWORKDAYS.INTL(43845, 43850, 99)', expect: { error: '#NUM!' }, why: 'invalid weekend number' },
  ]),
  d('WORKDAY', 'WORKDAY(start_date, days, [holidays])', 'Returns the date that is a number of working days (Monday-Friday, excluding holidays) before or after a date.', [
    '=WORKDAY(DATE(2020, 1, 15), 10)', '=WORKDAY(DATE(2020, 1, 15), -10)', { f: '=WORKDAY(DATE(2020, 1, 15), 10, {43850, 43851})', expect: 43861, why: 'holidays given as an array' }, '=WORKDAY(DATE(2020, 1, 18), 1)', '=WORKDAY(DATE(2020, 1, 15), 0)', '=WORKDAY("x", 1)',
  ]),
  d('YEARFRAC', 'YEARFRAC(start_date, end_date, [basis])', 'Returns the fraction of a year between two dates for a day-count basis (0 US 30/360, 1 actual/actual, 2 actual/360, 3 actual/365, 4 European 30/360).', [
    '=YEARFRAC(DATE(2020, 1, 1), DATE(2020, 7, 1))', '=YEARFRAC(DATE(2020, 1, 1), DATE(2020, 7, 1), 1)', '=YEARFRAC(DATE(2019, 3, 1), DATE(2020, 2, 15), 1)', '=YEARFRAC(DATE(2018, 6, 30), DATE(2021, 1, 1), 1)', '=YEARFRAC(DATE(2020, 1, 1), DATE(2020, 7, 1), 2)',
    '=YEARFRAC(DATE(2020, 1, 1), DATE(2020, 7, 1), 3)', '=YEARFRAC(DATE(2020, 1, 31), DATE(2020, 3, 31), 4)', { f: '=YEARFRAC(DATE(2020, 7, 1), DATE(2020, 1, 1))', expect: 0.5, why: 'the order of the dates does not matter' }, { f: '=YEARFRAC(43845, 44197, 5)', expect: { error: '#NUM!' }, why: 'invalid basis' },
  ]),
  d('DATEDIF', 'DATEDIF(start_date, end_date, unit)', 'Returns the difference between two dates in years ("Y"), months ("M"), days ("D"), or the remainders "MD", "YM", "YD".', [
    '=DATEDIF(DATE(2001, 1, 1), DATE(2003, 1, 1), "Y")', '=DATEDIF(DATE(2001, 6, 1), DATE(2002, 8, 15), "M")', '=DATEDIF(DATE(2001, 6, 1), DATE(2002, 8, 15), "D")', '=DATEDIF(DATE(2001, 6, 1), DATE(2002, 8, 15), "MD")', '=DATEDIF(DATE(2001, 6, 1), DATE(2002, 8, 15), "YM")', '=DATEDIF(DATE(2001, 6, 1), DATE(2002, 8, 15), "YD")', { f: '=DATEDIF(DATE(2002, 1, 1), DATE(2001, 1, 1), "Y")', expect: { error: '#NUM!' }, why: 'start_date after end_date' }, { f: '=DATEDIF(DATE(2001, 1, 1), DATE(2002, 1, 1), "Q")', expect: { error: '#NUM!' }, why: 'invalid unit' },
  ]),
];
