# Storage Bucket Setup Instructions

## What You Need to Do

To complete the submission feature, you need to create a Supabase Storage bucket for file uploads.

### Option 1: Via Supabase Dashboard (Easiest)

1. Go to your Supabase project: https://supabase.com/dashboard
2. Navigate to **Storage** in the left sidebar
3. Click **Create a new bucket**
4. Enter the bucket name: `faculty-submissions`
5. Click **Create bucket**
6. Click on the bucket name to open it
7. Under **Policies**, click **New policy**
8. Choose **For full customization, use custom policies**
9. Add this policy to allow authenticated users to upload:

```sql
CREATE POLICY "Allow authenticated faculty to upload"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'faculty-submissions' AND (auth.uid())::text = owner);
```

10. Add this policy for reading their own files:

```sql
CREATE POLICY "Allow users to read their own files"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'faculty-submissions' AND (auth.uid())::text = owner);
```

### Option 2: Via Supabase CLI

If you prefer command line:

```bash
# Set SUPABASE_PROJECT_ID and SUPABASE_ACCESS_TOKEN in your environment
supabase link --project-ref <your-project-id>
supabase storage buckets create faculty-submissions

# For policies, create a migration file in infrastructure/database/migrations/
```

## After Setup

1. The bucket will be used automatically by the submission API
2. Files will be stored at: `faculty-submissions/{faculty_id}/{submission_id}/{filename}`
3. Users can only upload/access their own submissions

## Database Tables Ready

Your database already has:

- ✅ `submissions` table - Stores submission metadata
- ✅ `document_versions` table - Tracks file versions with checksums
- ✅ `review_decisions` table - For admin approval/rejection

## API Ready

The new endpoint `/api/faculty/submissions/create` will:

1. Authenticate the faculty member
2. Upload the file to the storage bucket
3. Create submission and document version records
4. Calculate SHA-256 checksum for file integrity

## Testing

Once the bucket is created:

1. Go to Faculty Dashboard
2. Navigate to "Submit Requirement"
3. Fill in the form and select a file
4. Click "Submit Requirement"
5. You should see a success message with a reference ID
