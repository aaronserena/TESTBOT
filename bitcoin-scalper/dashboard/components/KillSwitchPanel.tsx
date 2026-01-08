'use client';

import { useState } from 'react';

interface KillSwitchPanelProps {
    isActive: boolean;
    onActivate: (reason: string) => void;
    onDeactivate: () => void;
}

export function KillSwitchPanel({ isActive, onActivate, onDeactivate }: KillSwitchPanelProps) {
    const [showModal, setShowModal] = useState(false);
    const [reason, setReason] = useState('');

    const handleActivate = () => {
        if (reason.trim()) {
            onActivate(reason);
            setShowModal(false);
            setReason('');
        }
    };

    return (
        <>
            <div
                className="card"
                style={{
                    background: isActive
                        ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.2) 0%, rgba(239, 68, 68, 0.1) 100%)'
                        : 'var(--bg-secondary)',
                    borderColor: isActive ? 'rgba(239, 68, 68, 0.5)' : 'var(--border)',
                }}
            >
                <div className="card-header">
                    <span className="card-title" style={{ color: isActive ? '#ef4444' : 'var(--text-secondary)' }}>
                        Kill Switch
                    </span>
                    <span
                        style={{
                            fontSize: '0.75rem',
                            padding: '0.25rem 0.75rem',
                            borderRadius: '9999px',
                            background: isActive ? 'rgba(239, 68, 68, 0.2)' : 'rgba(34, 197, 94, 0.1)',
                            color: isActive ? '#ef4444' : '#22c55e',
                            fontWeight: 600,
                        }}
                    >
                        {isActive ? 'ACTIVE' : 'READY'}
                    </span>
                </div>

                <div style={{ marginTop: '1rem' }}>
                    {isActive ? (
                        <button
                            onClick={onDeactivate}
                            style={{
                                width: '100%',
                                padding: '0.75rem',
                                background: 'var(--bg-tertiary)',
                                border: '1px solid var(--border)',
                                borderRadius: '0.5rem',
                                color: 'var(--text-primary)',
                                cursor: 'pointer',
                                fontWeight: 500,
                            }}
                        >
                            Deactivate Kill Switch
                        </button>
                    ) : (
                        <button
                            onClick={() => setShowModal(true)}
                            style={{
                                width: '100%',
                                padding: '0.75rem',
                                background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                                border: 'none',
                                borderRadius: '0.5rem',
                                color: 'white',
                                cursor: 'pointer',
                                fontWeight: 600,
                                transition: 'all 0.2s ease',
                            }}
                        >
                            ⚠️ Activate Kill Switch
                        </button>
                    )}
                </div>
            </div>

            {/* Modal */}
            {showModal && (
                <div
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'rgba(0, 0, 0, 0.8)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1000,
                    }}
                    onClick={() => setShowModal(false)}
                >
                    <div
                        className="card"
                        style={{
                            width: '100%',
                            maxWidth: '400px',
                            margin: '1rem',
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 style={{ marginBottom: '1rem', color: '#ef4444' }}>
                            ⚠️ Activate Kill Switch
                        </h3>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem', fontSize: '0.875rem' }}>
                            This will immediately stop all trading and cancel open orders.
                        </p>
                        <textarea
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="Enter reason for activation..."
                            style={{
                                width: '100%',
                                padding: '0.75rem',
                                background: 'var(--bg-tertiary)',
                                border: '1px solid var(--border)',
                                borderRadius: '0.5rem',
                                color: 'var(--text-primary)',
                                resize: 'vertical',
                                minHeight: '80px',
                                marginBottom: '1rem',
                            }}
                        />
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button
                                onClick={() => setShowModal(false)}
                                style={{
                                    flex: 1,
                                    padding: '0.75rem',
                                    background: 'var(--bg-tertiary)',
                                    border: '1px solid var(--border)',
                                    borderRadius: '0.5rem',
                                    color: 'var(--text-primary)',
                                    cursor: 'pointer',
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleActivate}
                                disabled={!reason.trim()}
                                style={{
                                    flex: 1,
                                    padding: '0.75rem',
                                    background: reason.trim()
                                        ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
                                        : 'var(--bg-tertiary)',
                                    border: 'none',
                                    borderRadius: '0.5rem',
                                    color: reason.trim() ? 'white' : 'var(--text-muted)',
                                    cursor: reason.trim() ? 'pointer' : 'not-allowed',
                                    fontWeight: 600,
                                }}
                            >
                                Confirm
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
