# Plan for Enhancing Simplii Financial Parser to Handle Multi-Line Transactions

## Problem Analysis
The current parser expects transaction data in a single line, but the actual text file has transactions split across multiple lines. This causes the parser to fail.

## Proposed Solution
1. Update the configuration for Simplii Chequing account to handle multi-line transactions
2. Modify the parser logic to use a state machine that assembles transaction blocks from multiple lines
3. Implement helper functions to process transaction blocks
4. Update the existing `parseChequing` function to use the new multi-line parsing when configured

## Implementation Details

### 1. Update `configs/simplii_cheq.js`
- Add `multiLineTransaction: true` flag
- Modify regex patterns to capture multi-line transactions:
```javascript
initialBalanceRegex: /^([A-Za-z]{3} \d{1,2})\s*\n\s*([A-Za-z]{3} \d{1,2})\s*\n\s*BALANCE FORWARD\s*\n\s*([\d,]+\.\d{2})/im,
transactionLineRegex: /^([A-Za-z]{3} \d{1,2})\s*\n\s*([A-Za-z]{3} \d{1,2})\s*\n\s*([\s\S]+?)\s*\n\s*([\d,]+\.\d{2})\s*\n\s*([\d,]+\.\d{2})\s*\n\s*([\d,]+\.\d{2})/im,
```

### 2. Implement Multi-line Parsing in `parser2.js`
- Create `parseMultiLineTransactions` function with state machine logic
- Add helper functions:
  - `isCompleteTransaction()`: Checks if buffer has all transaction components
  - `processTxBuffer()`: Converts buffer into transaction objects
- Update `parseChequing` to use new parser when flag is set

### 3. Testing Strategy
- Create `test-simplii.js` test script
- Verify:
  - All transactions are parsed (15+ in sample)
  - Metadata is correctly extracted
  - Funds in/out and balances are correct
  - Multi-page statements are handled properly

## Next Steps
1. Implement code changes in Code mode
2. Run test script to validate results
3. Iterate based on test findings