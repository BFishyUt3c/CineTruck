package com.example.foroservice.Application.Services;

import com.example.foroservice.Domain.Entities.Post;
import com.example.foroservice.Domain.Repositories.PostRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class PostService {

    private final PostRepository postRepository;

    public List<Post> getByThreadId(String threadId){
        return postRepository.findByThreadId(threadId);
    }

    public Page<Post> getByThreadIdPaginated(String threadId, Pageable pageable){
        return postRepository.findByThreadId(threadId, pageable);
    }

    public Page<Post> getAllPaginated(Pageable pageable){
        return postRepository.findAll(pageable);
    }

    public Post getById(String id){
        return postRepository.findById(id).orElseThrow(()->new RuntimeException("Post not found"));
    }

    public Post create(Post post){
        post.setDate(LocalDateTime.now());
        post.setVotes(0);
        return postRepository.save(post);
    }

    public void delete(String id){
        if (!postRepository.existsById(id)){
            throw new RuntimeException("Post not found");
        }
        postRepository.deleteById(id);
    }
}
