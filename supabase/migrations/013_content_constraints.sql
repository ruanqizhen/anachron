-- Content length constraints per PRD
ALTER TABLE threads ADD CONSTRAINT threads_title_length CHECK (length(title) BETWEEN 2 AND 100) NOT VALID;
ALTER TABLE threads ADD CONSTRAINT threads_content_length CHECK (length(content) >= 20) NOT VALID;
ALTER TABLE posts ADD CONSTRAINT posts_content_length CHECK (length(content) >= 5) NOT VALID;
ALTER TABLE boards ADD CONSTRAINT boards_name_unique UNIQUE (name);
