'use strict';

/**
 * Stream a CSV to the client in batches instead of building it in memory.
 *
 * The members export used to `findAll({ limit: 5000 })` and join everything into
 * one string. The cap existed to protect memory, but it cut the file off with
 * no sign that rows were missing, so an admin exporting a larger directory got
 * a short file that looked complete. Streaming removes the reason for the cap:
 * only one batch is ever held, so the file is as long as the data is.
 *
 * `fetchBatch(cursor)` returns `{ rows, next }`, where `next` is the cursor for
 * the following batch or null when there are no more. Cursor (keyset) paging
 * rather than OFFSET keeps every batch the same cost on a large table and stays
 * correct if rows arrive while the export runs.
 *
 * Once the first byte is out the status line is committed, so a failure part
 * way cannot become a JSON error. The file is ended with an explicit marker row
 * instead, so a truncated export is recognisable rather than silently short.
 */

const { csvRow } = require('./csv');

const BOM = '﻿'; // lets Excel read ₹ and Indian names as UTF-8

async function streamCsv(res, { filename, header, total, fetchBatch, toRow, log }) {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Cache-Control', 'no-store');
  if (Number.isFinite(total)) {
    res.setHeader('X-Total-Rows', String(total));
    res.setHeader('Access-Control-Expose-Headers', 'X-Total-Rows, Content-Disposition');
  }

  // Backpressure: wait for the socket to drain before sending more. Also resolve
  // on 'close'/'error' — a client that disconnects mid-download never drains, and
  // waiting on 'drain' alone would leave this export (and its connection) hanging.
  const write = (chunk) => new Promise((resolve) => {
    if (res.destroyed || res.writableEnded) return resolve();
    if (res.write(chunk)) return resolve();
    const release = () => {
      res.off('drain', release);
      res.off('close', release);
      res.off('error', release);
      resolve();
    };
    res.once('drain', release);
    res.once('close', release);
    res.once('error', release);
    return undefined;
  });

  let written = 0;
  try {
    await write(`${BOM}${csvRow(header)}\n`);
    let cursor = null;
    do {
      // The client went away (closed the tab, cancelled the download): stop
      // querying for a file nobody will read.
      if (res.destroyed || res.writableEnded) return { rows: written, aborted: true };
      const batch = await fetchBatch(cursor);
      if (batch.rows.length) {
        await write(`${batch.rows.map((r) => csvRow(toRow(r))).join('\n')}\n`);
        written += batch.rows.length;
      }
      cursor = batch.next;
    } while (cursor);
    res.end();
    return { rows: written, aborted: false };
  } catch (err) {
    if (log) log.error('CSV stream failed part-way', { error: err.message, rows: written });
    if (!res.destroyed && !res.writableEnded) {
      res.end(`# EXPORT INTERRUPTED after ${written} rows: this file is incomplete. Try again.\n`);
    }
    return { rows: written, aborted: true, error: err };
  }
}

module.exports = { streamCsv, BOM };
