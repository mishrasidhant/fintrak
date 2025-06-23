import fs from 'fs/promises';
import { parseStatement } from './parser2.js';

async function testParser() {
  try {
    // Read sample statement text
    const text = await fs.readFile('download_dir/txt/simplii-cheq.txt', 'utf-8');

    // Parse the statement
    const result = await parseStatement(text, 'simplii_cheq');

    // Log the results
    console.log('Metadata:', result.metadata);
    console.log('Transactions:', result.transactions);

    // Log the number of transactions parsed
    console.log(`Total transactions parsed: ${result.transactions.length}`);
  } catch (error) {
    console.error('Error parsing statement:', error);
  }
}

testParser();