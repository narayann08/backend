'use strict';
const mongoose = require('mongoose');
const logger = require('../../utils/logger');

/**
 * MCP Tool: ragRetrieverTool
 *
 * Search historical generation and weather-pattern embeddings for records similar
 * to the current situation using MongoDB Atlas Vector Search.
 * Used especially for newly commissioned plants with hasLimitedHistory=true.
 */
const ragRetrieverTool = {
  name: 'ragRetrieverTool',
  description:
    'Search historical generation and weather-pattern embeddings for records similar to the ' +
    'current situation. Use this especially for newly commissioned plants with hasLimitedHistory=true ' +
    'to find proxy data from similar plants or similar weather conditions.',
  inputSchema: {
    type: 'object',
    required: ['queryVector'],
    properties: {
      queryVector: {
        type: 'array',
        items: { type: 'number' },
        description: 'Embedding vector representing the current weather+plant situation',
      },
      topK:      { type: 'number', default: 5 },
      plantType: { type: 'string', enum: ['solar', 'wind'] },
    },
  },
  /**
   * @param {{ queryVector: number[], topK?: number, plantType?: string }} input
   */
  async handler(input) {
    const { queryVector, topK = 5, plantType } = input;
    try {
      const db         = mongoose.connection.db;
      const collection = db.collection('historicalEmbeddings');

      // MongoDB Atlas Vector Search aggregation pipeline
      const matchFilter = plantType ? { 'metadata.plantType': plantType } : {};

      const results = await collection.aggregate([
        {
          $vectorSearch: {
            index:        'vector_index',
            path:         'embedding',
            queryVector,
            numCandidates: topK * 10,
            limit:         topK,
            filter:        matchFilter,
          },
        },
        {
          $project: {
            _id:          0,
            metadata:     1,
            generationMW: 1,
            weather:      1,
            score:        { $meta: 'vectorSearchScore' },
          },
        },
      ]).toArray();

      return { results };
    } catch (err) {
      logger.warn('[RAG] Vector search failed:', err.message);
      return { results: [], error: err.message };
    }
  },
};

module.exports = ragRetrieverTool;
