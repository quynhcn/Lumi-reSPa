# Migrations Supabase cũ (chỉ để tham khảo)

9 file này là lịch sử schema khi SpaFlow còn chạy trên Supabase. **Không chạy chúng trên DB mới.**

- Schema hiện hành nằm ở `db/migrations/` (chạy bằng `npm run db:migrate`).
- `db/migrations/0002_app_schema.sql` được sinh từ 9 file này (pg_dump --schema-only, bỏ RLS).
- Thư mục này còn được dùng bởi `tests/import/run.sh` để dựng một DB "giống Supabase" làm nguồn khi thử script chuyển dữ liệu.
