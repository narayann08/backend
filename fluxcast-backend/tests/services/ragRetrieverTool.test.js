'use strict';
const mongoose = require('mongoose');
const ragRetrieverTool = require('../../src/services/mcp-tools/ragRetrieverTool');

describe('MCP Tool: ragRetrieverTool', () => {
  it('has valid MCP metadata and schema', () => {
    expect(ragRetrieverTool.name).toBe('ragRetrieverTool');
    expect(ragRetrieverTool.inputSchema.required).toContain('queryVector');
  });

  it('handles vector search aggregation query when database collection exists', async () => {
    const mockResults = [
      {
        metadata: { plantType: 'solar', capacityMW: 200 },
        generationMW: 150,
        score: 0.95,
      },
    ];

    const mockAggregate = jest.fn().mockReturnValue({
      toArray: jest.fn().mockResolvedValue(mockResults),
    });

    const mockCollection = jest.fn().mockReturnValue({
      aggregate: mockAggregate,
    });

    // Mock mongoose connection db
    const origDb = mongoose.connection.db;
    mongoose.connection.db = { collection: mockCollection };

    const result = await ragRetrieverTool.handler({
      queryVector: [0.1, 0.2, 0.3],
      topK: 3,
      plantType: 'solar',
    });

    expect(result.results).toEqual(mockResults);
    expect(mockCollection).toHaveBeenCalledWith('historicalEmbeddings');

    // Restore
    mongoose.connection.db = origDb;
  });

  it('handles database errors gracefully and returns empty array with error message', async () => {
    const origDb = mongoose.connection.db;
    mongoose.connection.db = {
      collection: () => {
        throw new Error('Vector search index not found');
      },
    };

    const result = await ragRetrieverTool.handler({
      queryVector: [0.1, 0.2, 0.3],
    });

    expect(result.results).toEqual([]);
    expect(result.error).toContain('Vector search index not found');

    mongoose.connection.db = origDb;
  });
});
