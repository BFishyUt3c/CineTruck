package com.example.foroservice.Domain.Repositories;

import com.example.foroservice.Domain.Entities.Post;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PostRepository extends MongoRepository<Post,String> {
    List<Post> findByThreadId(String threadId);
    List<Post> findByUserId(String userId);
    Page<Post> findAll(Pageable pageable);
    Page<Post> findByThreadId(String threadId, Pageable pageable);
    Page<Post> findByUserId(String userId, Pageable pageable);
}
