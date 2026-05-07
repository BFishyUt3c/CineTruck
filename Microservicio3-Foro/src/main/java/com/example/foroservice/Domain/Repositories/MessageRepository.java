package com.example.foroservice.Domain.Repositories;

import com.example.foroservice.Domain.Entities.Message;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MessageRepository extends MongoRepository<Message, String> {
    List<Message> findByThreadId(String userId);
    Page<Message> findAll(Pageable pageable);
    Page<Message> findByThreadId(String threadId, Pageable pageable);
}
