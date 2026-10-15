// Minimal runtime stand-ins for the n8n-workflow exports the nodes use.
class NodeOperationError extends Error {
	constructor(node, message) {
		super(typeof message === 'string' ? message : 'Node operation error');
		this.node = node;
	}
}

class NodeApiError extends Error {
	constructor(node, cause, options = {}) {
		super(options.message || 'API error');
		this.node = node;
		this.cause = cause;
	}
}

module.exports = {
	NodeConnectionTypes: { Main: 'main' },
	NodeOperationError,
	NodeApiError,
};
