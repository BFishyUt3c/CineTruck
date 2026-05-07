package com.example.foroservice.Infrastructure.Controllers;

import com.example.foroservice.Application.Services.PostService;
import com.example.foroservice.Domain.Entities.Post;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/posts")
@RequiredArgsConstructor
public class PostController {

    private final PostService postService;

    @GetMapping("/all")
    public ResponseEntity<Page<Post>> getAllPaginated(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "date") String sortBy,
            @RequestParam(defaultValue = "DESC") Sort.Direction direction) {
        Pageable pageable = PageRequest.of(page, size, Sort.by(direction, sortBy));
        return ResponseEntity.ok(postService.getAllPaginated(pageable));
    }

    @GetMapping("/thread/{threadId}")
    public ResponseEntity<List<Post>> getByThreadId(@PathVariable String threadId) {
        return ResponseEntity.ok(postService.getByThreadId(threadId));
    }

    @GetMapping("/thread/{threadId}/paginated")
    public ResponseEntity<Page<Post>> getByThreadIdPaginated(
            @PathVariable String threadId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "date") String sortBy,
            @RequestParam(defaultValue = "DESC") Sort.Direction direction) {
        Pageable pageable = PageRequest.of(page, size, Sort.by(direction, sortBy));
        return ResponseEntity.ok(postService.getByThreadIdPaginated(threadId, pageable));
    }

    @GetMapping("/{id}")
    public ResponseEntity<Post> getById(@PathVariable String id) {
        return ResponseEntity.ok(postService.getById(id));
    }

    @PostMapping
    public ResponseEntity<Post> create(@RequestBody Post post) {
        return ResponseEntity.status(HttpStatus.CREATED).body(postService.create(post));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable String id) {
        postService.delete(id);
        return ResponseEntity.noContent().build();
    }

}
