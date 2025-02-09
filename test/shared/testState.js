// Singleton object to store shared test state
const globalState = {
    // Contract addresses
    fakeDaiAddress: null,
    conditionalTokensAddress: null,
    factoryAddress: null,
    marketAddress: null,

    // Market parameters
    outcomes: null,
    outcomeSlots: null,
    outcomeIndices: null,
    questionId: null,
    question: null,
    subsidy: null,

    // Test participants
    signers: {
        admin: null,
        userA: null,
        mrResolver: null,
        alice: null,
        otherUsers: []
    },

    // Balances
    initialBalances: {
        userA: null,
        alice: null
    },

    // Helper methods
    set(key, value) {
        if (typeof value === 'object' && value !== null) {
            this[key] = {...value};  // Deep copy for objects
        } else {
            this[key] = value;
        }
        console.log(`Global State Updated: ${key}`);
    },

    validate(stage, requiredKeys) {
        const missing = requiredKeys.filter(key => {
            const keys = key.split('.');
            let value = this;
            for (const k of keys) {
                value = value[k];
                if (value === undefined || value === null) return true;
            }
            return false;
        });
        if (missing.length > 0) {
            throw new Error(`${stage}: Missing required state: ${missing.join(', ')}`);
        }
    },

    reset() {
        Object.keys(this).forEach(key => {
            if (typeof this[key] !== 'function') {
                if (typeof this[key] === 'object' && this[key] !== null) {
                    Object.keys(this[key]).forEach(subKey => {
                        this[key][subKey] = null;
                    });
                } else {
                    this[key] = null;
                }
            }
        });
        console.log("Global state reset");
    }
};

module.exports = globalState; 