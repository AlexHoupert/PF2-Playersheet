import React, { useState } from 'react';
import { db as firestore } from '../shared/db/firebase-config';
import { doc, setDoc } from 'firebase/firestore';
import { DB_STORAGE_KEY } from '../shared/db/legacy-import/usePersistedDb';
import { normalizeMasterToV2 } from '../shared/db/v2/normalizers';
import { writeMasterMigrationToV2 } from '../shared/db/v2/firestoreMigration';
import { useAppFeedback } from '../shared/feedback/AppFeedback';

function safeTimestamp() {
    return new Date().toISOString().replace(/[:.]/g, '-');
}

function downloadJson(filename, data) {
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

export default function FirebaseMigrator({ db }) {
    const [status, setStatus] = useState(null);
    const [backupStatus, setBackupStatus] = useState(null);
    const [v2Status, setV2Status] = useState(null);
    const [v2Report, setV2Report] = useState(null);
    const { confirm, notifyError, notifySuccess, prompt } = useAppFeedback();
    const allowLegacyMasterUpload = import.meta.env.VITE_ENABLE_LEGACY_MASTER_UPLOAD === 'true';

    const handleUpload = async () => {
        if (!allowLegacyMasterUpload) {
            notifyError('Legacy master upload is disabled. Set VITE_ENABLE_LEGACY_MASTER_UPLOAD=true only for an emergency restore.', { title: 'Upload disabled' });
            return;
        }
        const confirmed = await confirm({
            title: 'Overwrite legacy master',
            message: 'Overwrite legacy data/master with current LOCAL data? This can erase newer cloud data.',
            confirmLabel: 'Overwrite',
            danger: true,
        });
        if (!confirmed) return;

        setStatus('working');
        try {
            const rawData = localStorage.getItem(DB_STORAGE_KEY);
            if (!rawData) throw new Error('No local data found.');

            const data = JSON.parse(rawData);

            if (!firestore) throw new Error('Firebase Firestore not initialized.');
            if (!firestore.app.options.apiKey || firestore.app.options.apiKey.includes('YOUR_')) {
                throw new Error('Invalid Firebase Config. Check Environment Variables.');
            }

            const uploadTask = setDoc(doc(firestore, 'data', 'master'), data);
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Upload timed out (10s). Check console/network.')), 10000)
            );

            await Promise.race([uploadTask, timeoutPromise]);

            setStatus('success');
            notifySuccess('Legacy data/master upload complete.');
        } catch (err) {
            console.error('Legacy upload error:', err);
            setStatus('error');
            notifyError(err, { title: 'Legacy upload failed' });
        }
    };

    const handleDownloadBackup = () => {
        setBackupStatus(null);
        try {
            let data = db;
            if (!data) {
                const rawData = localStorage.getItem(DB_STORAGE_KEY);
                if (!rawData) throw new Error('No current data found.');
                data = JSON.parse(rawData);
            }

            downloadJson(`pf2e-data-backup-${safeTimestamp()}.json`, data);
            setBackupStatus('success');
        } catch (err) {
            console.error('Backup Error:', err);
            setBackupStatus('error');
            notifyError(err, { title: 'Backup failed' });
        }
    };

    const handleDryRunV2 = () => {
        setV2Status(null);
        try {
            const normalized = normalizeMasterToV2(db);
            setV2Report(normalized.report);
            downloadJson(`pf2e-v2-migration-report-${safeTimestamp()}.json`, normalized.report);
            setV2Status('dry-run-success');
        } catch (err) {
            console.error('V2 dry run failed:', err);
            setV2Status('error');
            notifyError(err, { title: 'V2 dry run failed' });
        }
    };

    const handleMigrateV2 = async () => {
        const typed = await prompt({
            title: 'Write Firestore V2',
            message: 'This writes normalized Firestore v2 documents and creates a backup of data/master first. Type MIGRATE V2 to continue.',
            confirmLabel: 'Migrate',
            danger: true,
        });
        if (typed !== 'MIGRATE V2') return;

        setV2Status('working');
        try {
            const normalized = await writeMasterMigrationToV2(firestore, db, { backup: true });
            setV2Report(normalized.report);
            setV2Status('success');
            downloadJson(`pf2e-v2-migration-report-${safeTimestamp()}.json`, normalized.report);
            notifySuccess(`V2 migration complete. Wrote ${normalized.documents.length} documents. Reload the V2 runtime to test the normalized store.`);
        } catch (err) {
            console.error('V2 migration failed:', err);
            setV2Status('error');
            notifyError(err, { title: 'V2 migration failed' });
        }
    };

    const isConfigured = firestore && firestore.app.options.apiKey !== 'YOUR_API_KEY';

    if (!isConfigured) return null;

    return (
        <div style={{ padding: 20, border: '1px dashed #666', borderRadius: 8, margin: '20px 0', background: '#222' }}>
            <h3>Firebase Data Tools</h3>

            <div style={{ marginBottom: 20 }}>
                <h3>Firestore V2 Migration</h3>
                <p>Normalize legacy data/master into campaign documents, character subcollections, custom content, and a migration report.</p>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <button
                        onClick={handleDryRunV2}
                        className="set-btn"
                        style={{ background: '#607d8b' }}
                    >
                        Dry Run V2 Migration
                    </button>
                    <button
                        onClick={handleMigrateV2}
                        className="set-btn"
                        disabled={v2Status === 'working'}
                        style={{ background: v2Status === 'success' ? '#4caf50' : '#2196f3' }}
                    >
                        {v2Status === 'working' ? 'Migrating...' : 'Write Firestore V2'}
                    </button>
                </div>
                {v2Status === 'dry-run-success' && <p style={{ color: '#8bc34a' }}>Dry run report downloaded.</p>}
                {v2Status === 'success' && <p style={{ color: '#8bc34a' }}>V2 migration complete. Reload the app to test the normalized store.</p>}
                {v2Status === 'error' && <p style={{ color: 'red' }}>V2 migration failed. Check console for details.</p>}
                {v2Report && (
                    <p style={{ color: '#aaa', fontSize: '0.85em' }}>
                        Report: {v2Report.totalDocuments} docs, {v2Report.renamedFields.length} renamed fields, {v2Report.invalidValues.length} invalid values, {v2Report.fallbackAssumptions.length} assumptions.
                    </p>
                )}
            </div>

            {allowLegacyMasterUpload && (
                <div style={{ marginBottom: 20, paddingTop: 20, borderTop: '1px solid #444' }}>
                    <h3>Legacy data/master Upload</h3>
                    <p>Emergency-only: overwrite the old single-document database from localStorage.</p>
                    <button
                        onClick={handleUpload}
                        className="set-btn"
                        disabled={status === 'working'}
                        style={{ background: status === 'success' ? '#4caf50' : '#9c27b0' }}
                    >
                        {status === 'working' ? 'Uploading...' : 'Upload Legacy Master'}
                    </button>
                    {status === 'error' && <p style={{ color: 'red' }}>Check console for errors.</p>}
                </div>
            )}

            <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid #444' }}>
                <h3>Manual Backup</h3>
                <button
                    onClick={handleDownloadBackup}
                    className="set-btn"
                    style={{ background: backupStatus === 'success' ? '#4caf50' : '#c5a059', color: '#111' }}
                >
                    Download Data Backup
                </button>
                {backupStatus === 'success' && <p style={{ color: '#8bc34a' }}>Backup downloaded.</p>}
                {backupStatus === 'error' && <p style={{ color: 'red' }}>Backup failed.</p>}
            </div>
        </div>
    );
}
