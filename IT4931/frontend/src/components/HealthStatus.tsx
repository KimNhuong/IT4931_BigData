import React, { useEffect, useState } from 'react';
import { getSystemHealth, type HealthResponse } from '../services/api';
import { Database, Layers, CheckCircle, AlertTriangle } from 'lucide-react';

export const HealthStatus: React.FC = () => {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const checkHealth = async () => {
    try {
      const data = await getSystemHealth();
      setHealth(data);
      setError(null);
    } catch (err: any) {
      setError('Backend service unreachable');
      setHealth({
        status: 'error',
        timestamp: new Date().toISOString(),
        services: {
          elasticsearch: 'down',
          redis: 'down',
        },
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 5000); // check health every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const isHealthy = health?.status === 'ok';

  return (
    <div className="card">
      <div className="card-title">
        <span>System Infrastructure Health</span>
        {loading && <span className="spinner" style={{ width: '12px', height: '12px', borderWidth: '1.5px' }} />}
      </div>

      {error && (
        <div style={{ color: 'var(--color-danger)', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
          <AlertTriangle size={14} />
          <span>{error}</span>
        </div>
      )}

      <div className="health-list">
        <div className="health-item">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Layers size={18} style={{ color: 'var(--color-primary)' }} />
            <span style={{ fontSize: '14px', fontWeight: 500 }}>Elasticsearch Storage</span>
          </div>
          <div className="status-indicator">
            <span className={`dot ${health?.services.elasticsearch === 'up' ? 'up' : 'down'}`} />
            <span style={{ color: health?.services.elasticsearch === 'up' ? 'var(--color-success)' : 'var(--color-danger)' }}>
              {health?.services.elasticsearch === 'up' ? 'Online' : 'Offline'}
            </span>
          </div>
        </div>

        <div className="health-item">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Database size={18} style={{ color: 'var(--color-warning)' }} />
            <span style={{ fontSize: '14px', fontWeight: 500 }}>Redis Aggregation</span>
          </div>
          <div className="status-indicator">
            <span className={`dot ${health?.services.redis === 'up' ? 'up' : 'down'}`} />
            <span style={{ color: health?.services.redis === 'up' ? 'var(--color-success)' : 'var(--color-danger)' }}>
              {health?.services.redis === 'up' ? 'Online' : 'Offline'}
            </span>
          </div>
        </div>
      </div>

      <div style={{
        marginTop: '16px',
        paddingTop: '12px',
        borderTop: '1px solid var(--border-color)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: '12px',
        color: 'var(--text-secondary)'
      }}>
        <span>Overall Status:</span>
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          fontWeight: 600,
          color: isHealthy ? 'var(--color-success)' : 'var(--color-danger)'
        }}>
          {isHealthy ? <CheckCircle size={12} /> : <AlertTriangle size={12} />}
          {isHealthy ? 'Healthy' : 'Degraded'}
        </span>
      </div>
    </div>
  );
};
